import { createManagedResearchCoverageFixture } from "./test-managed-research-coverage-fixture";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS,
  PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY,
  type PersonalSecAnnualCanonicalResponseDto,
} from "@research-cockpit/contracts";
import {
  derivePersonalSecAnnualCanonicalView,
  type PersonalSecAnnualCanonicalView,
} from "@research-cockpit/personal-financial-analytics";
import { canonicalAnnualPacket } from "../features/research/sec-annual-canonical-fixture";
import { parseSecAnnualCanonicalResponse } from "../lib/sec-annual-canonical-response";
import {
  bindAnnualPacket,
  type TestAnnualPacket,
} from "../lib/test-personal-sec-annual-api-fixture";
import { ManagedAnnualReport } from "./managed-annual-report";
import { eodSelection } from "./eod-history-fixture";
import {
  prepareCompanyReport,
  companyReportIsCurrent,
} from "./managed-company-report";
import {
  formatCompanyReportDocument,
  COMPANY_REPORT_DOCUMENT_MAX_BYTES,
} from "./managed-company-report-document";
import { CompanyReportHtmlView } from "./CompanyReportHtmlView";
import {
  companyReportHtmlByteLength,
  COMPANY_REPORT_HTML_MAX_BYTES,
} from "./managed-company-report-html";
import {
  COMPANY_REPORT_HTML_CSP,
  COMPANY_REPORT_HTML_STYLE,
} from "./company-report-html-style";
import { reportAnnualPacket } from "./managed-annual-statements-report-fixture";
import type { ReportAnnualFixtureOptions } from "./managed-annual-statements-report-fixture";
import { annualReportPacket } from "./test-annual-report-fixture";
import { getManagedAnnualView } from "./managed-annual-view";
import {
  createNativeCompanyReportAdapter,
  type InvestmentCompanyReportPlugin,
} from "./native-company-report";

type CapturedAnnual = {
  response: PersonalSecAnnualCanonicalResponseDto;
  statements: PersonalSecAnnualCanonicalView["statements"];
  financials: {
    income: Pick<
      PersonalSecAnnualCanonicalView["income"],
      "resolution" | "reason" | "bases"
    >;
    cashGeneration: PersonalSecAnnualCanonicalView["cashGeneration"];
    liquidity: PersonalSecAnnualCanonicalView["liquidity"];
    operatingResults: PersonalSecAnnualCanonicalView["operatingResults"];
    balanceSheet: PersonalSecAnnualCanonicalView["balanceSheet"];
    cashMargins: PersonalSecAnnualCanonicalView["cashMargins"];
    financialReview: PersonalSecAnnualCanonicalView["financialReview"];
  };
};
function parseReport(text: string): {
  schemaVersion: string;
  sources: { annual: CapturedAnnual };
} {
  return JSON.parse(text) as {
    schemaVersion: string;
    sources: { annual: CapturedAnnual };
  };
}

const now = () => new Date("2026-10-15T00:00:00.000Z");
async function loaded(input?: PersonalSecAnnualCanonicalResponseDto) {
  const packet = input ?? (await reportAnnualPacket());
  const selection = {
    ...eodSelection,
    cik: packet.security.cik,
    listing: {
      ...eodSelection.listing,
      listingId: packet.security.listingId,
      symbol: packet.security.symbol,
      issuerId: packet.security.issuerId,
      issuerName: packet.security.issuerName,
      securityName: packet.security.securityName,
    },
  };
  const read = vi.fn().mockResolvedValue(packet);
  const annual = new ManagedAnnualReport(read, vi.fn(), undefined, {
    coverage: createManagedResearchCoverageFixture([
      { listing: selection.listing, cik: selection.cik },
    ]),
  });
  annual.open(selection);
  await annual.load();
  expect(annual.getSnapshot().response).not.toBeNull();
  const evidence = () => ({
    interim: null,
    price: null,
    annual: annual.getSnapshot(),
    filings: null,
  });
  const draft = {
    member: { ...selection.listing, note: "Exact authored Café 東京 📈" },
    canEdit: true,
    canAdd: false,
    reason: null,
    revision: Symbol("draft"),
  };
  const report = prepareCompanyReport(selection, evidence(), draft, now)!;
  expect(report).not.toBeNull();
  return { report, selection, read, annual, evidence, draft };
}

function fullHtml(
  report: NonNullable<ReturnType<typeof prepareCompanyReport>>,
) {
  const json = formatCompanyReportDocument(report)!;
  const text =
    "<!doctype html>\n" +
    renderToStaticMarkup(
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta
            httpEquiv="Content-Security-Policy"
            content={COMPANY_REPORT_HTML_CSP}
          />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>{`Company research · ${report.selection.listing.symbol}`}</title>
          <style>{COMPANY_REPORT_HTML_STYLE}</style>
        </head>
        <body>
          <CompanyReportHtmlView report={report} jsonText={json.text} />
        </body>
      </html>,
    ) +
    "\n";
  return {
    text,
    bytes: companyReportHtmlByteLength(text),
    rawBytes: new TextEncoder().encode(text).byteLength,
    json,
  };
}

describe("canonical statements in captured schema6 company reports", () => {
  it("keeps three flow periods and two balance dates with missing income and independent negative equity", async () => {
    const conceptRows: NonNullable<ReportAnnualFixtureOptions["conceptRows"]> =
      {};
    for (const entry of PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY) {
      conceptRows[entry.concept] =
        entry.concept === "NetIncomeLoss"
          ? []
          : (entry.periodType === "instant"
              ? [2025, 2024]
              : [2025, 2024, 2023]
            ).map((year, index) => ({
              startDate:
                entry.periodType === "instant" ? null : `${year}-01-01`,
              endDate: `${year}-12-31`,
              durationDays:
                entry.periodType === "instant"
                  ? null
                  : year === 2024
                    ? 366
                    : 365,
              value:
                entry.concept === "StockholdersEquity"
                  ? `-${index + 1}.000000000000000001`
                  : `${index + 1}.000000000000000001`,
            }));
    }
    const f = await loaded(await reportAnnualPacket({ conceptRows }));
    const captured = parseReport(formatCompanyReportDocument(f.report)!.text)
      .sources.annual;
    expect(
      captured.financials.income.resolution.selectedReportPairEligible,
    ).toBe(false);
    expect(captured.financials.cashGeneration.history.status).toBe("available");
    expect(
      captured.financials.balanceSheet.resolution.shareholdersEquity,
    ).toMatchObject({ status: "available", value: "-1.000000000000000001" });
    for (const statement of captured.statements.statements) {
      expect(
        statement.columns.map((column: { endDate: string }) => column.endDate),
      ).toEqual(
        statement.id === "balance_sheet"
          ? ["2025-12-31", "2024-12-31"]
          : ["2025-12-31", "2024-12-31", "2023-12-31"],
      );
    }
    const income = captured.statements.statements.find(
      (statement: { id: string }) => statement.id === "income_statement",
    );
    expect(
      income!.rows
        .find((row) => row.concept === "NetIncomeLoss")!
        .cells.every(
          (cell) =>
            cell.status === "unavailable" && cell.reason === "concept_missing",
        ),
    ).toBe(true);
  });

  it("captures the graph once and explicit resolved results, with no raw projection or enriched view", async () => {
    const f = await loaded(
      await reportAnnualPacket({
        operatingIncome: "9007199254740993.000000000000000001",
        shareholdersEquity: "-9007199254740993.000000000000000003",
      }),
    );
    const document = formatCompanyReportDocument(f.report)!;
    const data = parseReport(document.text);
    expect(data.schemaVersion).toBe("6.0.0");
    const captured = data.sources.annual;
    const source = f.annual.getSnapshot();
    expect(captured.response).toEqual(source.response);
    expect(captured.statements).toEqual(source.view!.statements);
    expect(captured.financials).toEqual({
      income: {
        resolution: source.view!.income.resolution,
        reason: source.view!.income.reason,
        bases: source.view!.income.bases,
      },
      cashGeneration: source.view!.cashGeneration,
      liquidity: source.view!.liquidity,
      operatingResults: source.view!.operatingResults,
      balanceSheet: source.view!.balanceSheet,
      cashMargins: source.view!.cashMargins,
      financialReview: source.view!.financialReview,
    });
    let graphs = 0;
    const observationObjects: string[] = [];
    function inspect(value: unknown) {
      if (!value || typeof value !== "object") return;
      if (Array.isArray(value)) {
        value.forEach(inspect);
        return;
      }
      const record = value as Record<string, unknown>;
      expect(Object.hasOwn(record, "view")).toBe(false);
      expect(Object.hasOwn(record, "canonical")).toBe(false);
      expect(Object.hasOwn(record, "metric")).toBe(false);
      if (Array.isArray(record.observations)) graphs++;
      if (typeof record.sourceLocator === "string") {
        expect(typeof record.id).toBe("string");
        observationObjects.push(String(record.id));
      }
      Object.values(record).forEach(inspect);
    }
    inspect(data);
    expect(graphs).toBe(1);
    expect(observationObjects).toEqual(
      source.response!.evidence.facts.observations.map((row) => row.id),
    );
    expect(new Set(observationObjects).size).toBe(observationObjects.length);
    expect(captured.financials.financialReview).toHaveLength(5);
    expect(
      captured.statements.statements.map((item: { id: string }) => item.id),
    ).toEqual(["income_statement", "balance_sheet", "cash_flow"]);
    const html = fullHtml(f.report);
    for (const entry of PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY)
      expect(html.text).toContain(entry.concept);
    expect(html.text).toContain("-9007199254740993.000000000000000003");
    expect(html.text).not.toMatch(
      /<(?:script|button|input|select|form|img|link|iframe)(?:\s|>)/u,
    );
    expect(html.text).not.toMatch(/<[^>]*\s(?:src|href|on\w+)=/u);
    expect(html.bytes).toBe(html.rawBytes);
    expect(f.read).toHaveBeenCalledOnce();
  });

  it("refuses cloned responses and separately derived equal views at preparation and formatting", async () => {
    const f = await loaded();
    const original = f.annual.getSnapshot();
    const other = await annualReportPacket("right");
    for (const changed of [
      { ...original, response: structuredClone(original.response) },
      {
        ...original,
        view: derivePersonalSecAnnualCanonicalView(original.response!.evidence),
      },
      { ...original, view: null },
      { ...original, response: other, view: getManagedAnnualView(other) },
    ]) {
      const evidence = { ...f.evidence(), annual: changed };
      expect(
        prepareCompanyReport(f.selection, evidence, f.draft, now),
      ).toBeNull();
      expect(
        companyReportIsCurrent(f.report, f.selection, evidence, f.draft),
      ).toBe(false);
      expect(formatCompanyReportDocument({ ...f.report, evidence })).toBeNull();
    }
    const checking = { ...original, checkingSeed: true };
    expect(
      prepareCompanyReport(
        f.selection,
        { ...f.evidence(), annual: checking },
        f.draft,
        now,
      ),
    ).toBeNull();
    const restored = { ...f.draft, revision: Symbol("edit then restore") };
    expect(
      companyReportIsCurrent(f.report, f.selection, f.evidence(), restored),
    ).toBe(false);
    expect(f.read).toHaveBeenCalledOnce();
  });

  it("keeps unresolved context and empty axes alongside complete scan metadata without invented dates", async () => {
    const packet = structuredClone(
      await reportAnnualPacket(),
    ) as TestAnnualPacket;
    packet.evidence.target = {
      status: "unresolved",
      reason: "submissions_unavailable",
    };
    packet.evidence.targetScan = null;
    Object.assign(packet.evidence.generation.sources.submissions, {
      status: "upstream_unavailable",
      fetchedAt: null,
      sha256: null,
      bytes: null,
    });
    packet.evidence.facts.observations = [];
    for (const item of packet.evidence.facts.scans)
      if (item.scan.status === "available") {
        item.scan.coverage.selected = null;
        item.scan.coverage.otherAccessions = null;
        item.scan.coverage.returned = 0;
        item.scan.coverage.omittedSelected = null;
      }
    const f = await loaded(await bindAnnualPacket(packet));
    const data = parseReport(formatCompanyReportDocument(f.report)!.text)
      .sources.annual;
    expect(data.statements.contextReason).toBe("source_unavailable");
    for (const statement of data.statements.statements) {
      expect(statement.columns).toEqual([]);
      expect(statement.rows.every((row) => row.cells.length === 0)).toBe(true);
    }
    expect(data.response.evidence.facts.scans).toHaveLength(32);
    expect(fullHtml(f.report).text).toContain(
      "An annual filing could not be selected for this load.",
    );
  });

  it.each([
    [50, false],
    [50, true],
    [60, true],
  ] as const)(
    "measures complete canonical capture/HTML at %i rows per concept, escaped metadata=%s",
    async (rowsPerConcept, escapedMetadata) => {
      const source = structuredClone(
        await canonicalAnnualPacket({ rowsPerConcept, escapedMetadata }),
      ) as TestAnnualPacket;
      for (const [index, row] of source.evidence.facts.observations.entries()) {
        const sign = row.value.startsWith("-") ? "-" : "";
        row.value =
          sign +
          "9".repeat(59 - sign.length) +
          "." +
          String(index * 2 + 1).padStart(4, "0");
        if (escapedMetadata) {
          row.frame = '"'.repeat(128);
          row.filingFocusPeriod = '"'.repeat(32);
        }
      }
      const raw = await bindAnnualPacket(source);
      const wireBytes = new TextEncoder().encode(
        JSON.stringify(raw),
      ).byteLength;
      expect(raw.evidence.facts.observations).toHaveLength(rowsPerConcept * 32);
      expect(wireBytes).toBeLessThanOrEqual(
        MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS.responseBytes,
      );
      const admitted = await parseSecAnnualCanonicalResponse(
        raw,
        {
          schemaVersion: "6.0.0",
          catalogSnapshotSha256: raw.catalogSnapshotSha256,
          listingId: raw.security.listingId,
          symbol: raw.security.symbol,
        },
        new AbortController().signal,
      );
      expect(admitted).not.toBeNull();
      const f = await loaded(admitted!);
      const result = fullHtml(f.report);
      expect(result.json.byteLength).toBeLessThanOrEqual(
        COMPANY_REPORT_DOCUMENT_MAX_BYTES,
      );
      expect(
        parseReport(result.json.text).sources.annual.response.evidence.facts
          .observations,
      ).toHaveLength(rowsPerConcept * 32);
      const ids = new Set(result.text.match(/sec-fact:[a-f0-9]{64}/gu));
      for (const row of admitted!.evidence.facts.observations)
        expect(ids.has(row.id)).toBe(true);
      expect(result.bytes).toBe(
        result.rawBytes > COMPANY_REPORT_HTML_MAX_BYTES
          ? null
          : result.rawBytes,
      );
      if (rowsPerConcept === 60) {
        expect(result.rawBytes).toBeGreaterThan(COMPANY_REPORT_HTML_MAX_BYTES);
        expect(result.bytes).toBeNull();
      } else expect(result.bytes).not.toBeNull();
      const expected =
        rowsPerConcept === 60
          ? { wire: 2072519, json: 2445335, html: 8950265 }
          : escapedMetadata
            ? { wire: 1728729, json: 2042265, html: 7475055 }
            : { wire: 1231479, json: 1544415, html: 4175787 };
      expect({
        wire: wireBytes,
        json: result.json.byteLength,
        html: result.rawBytes,
      }).toEqual(expected);
      const plugin: InvestmentCompanyReportPlugin = {
        choose: vi.fn().mockResolvedValue({
          status: "chosen",
          handle: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        }),
        write: vi.fn().mockResolvedValue({ status: "written" }),
        cancel: vi.fn().mockResolvedValue(undefined),
      };
      await expect(
        createNativeCompanyReportAdapter(plugin, {
          choose: () => Promise.resolve({ status: "cancelled" }),
          write: () => Promise.resolve({ status: "written" }),
          cancel: () => Promise.resolve(),
        }).deliver(result.json, {
          signal: new AbortController().signal,
          isCurrent: () => true,
        }),
      ).resolves.toBe("written");
      expect(plugin.write).toHaveBeenCalledWith(
        expect.objectContaining({ text: result.json.text }),
      );
      expect(f.read).toHaveBeenCalledOnce();
    },
    20000,
  );

  it("uses an exact whole-output HTML bound and refuses one more UTF-8 byte without clipping", () => {
    expect(
      companyReportHtmlByteLength("x".repeat(COMPANY_REPORT_HTML_MAX_BYTES)),
    ).toBe(COMPANY_REPORT_HTML_MAX_BYTES);
    expect(
      companyReportHtmlByteLength(
        "x".repeat(COMPANY_REPORT_HTML_MAX_BYTES) + "x",
      ),
    ).toBeNull();
    expect(
      companyReportHtmlByteLength(
        "x".repeat(COMPANY_REPORT_HTML_MAX_BYTES - 1) + "é",
      ),
    ).toBeNull();
    expect(companyReportHtmlByteLength("\ud800")).toBeNull();
  });
});
