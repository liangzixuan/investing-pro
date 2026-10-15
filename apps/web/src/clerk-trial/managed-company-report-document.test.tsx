import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { eodSelection, eodResponse } from "./eod-history-fixture";
import { filingsResponse } from "./sec-filings-fixture";
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
import { ManagedEodHistory } from "./managed-eod-history";
import { ManagedAnnualReport } from "./managed-annual-report";
import { ManagedCompanyFilings } from "./managed-company-filings";
import { companySnapshotEvidence } from "./managed-company-snapshot";
import { prepareCompanyReport } from "./managed-company-report";
import {
  isCompanyReportDocument,
  formatCompanyReportDocument,
  COMPANY_REPORT_DOCUMENT_MAX_BYTES,
} from "./managed-company-report-document";
import {
  CompanyReportDocument,
  CompanyReportDocumentView,
} from "./CompanyReportDocument";

const note =
  "My Cafe\u0301 東京 📈 draft\n<unverified-link> & exact whitespace  ";
const now = () => new Date("2026-10-15T00:00:00.000Z");

function decode(text: string) {
  return JSON.parse(text) as {
    purpose: unknown;
    schemaVersion: unknown;
    preparedAt: unknown;
    catalogSnapshotSha256: unknown;
    listing: unknown;
    authoredResearch: unknown;
    sources: Record<"price" | "annual" | "filings", unknown>;
  };
}

async function fixture() {
  const annualPacket = await response([
    row(),
    row("SalesRevenueNet", "900"),
    row("NetIncomeLoss", "100"),
  ]);
  const packet = {
    ...annualPacket,
    evidence: {
      ...annualPacket.evidence,
      cashGeneration: await cashGeneration(annualPacket.evidence, [
        cashRow("operating_cash_flow", "250"),
        cashRow("ppe_purchases", "75"),
      ]),
      liquidity: await liquidity(annualPacket.evidence, [
        liquidityRow("current_assets", "800"),
        liquidityRow("current_liabilities", "400"),
      ]),
    },
  };
  const priceRead = vi.fn().mockResolvedValue(eodResponse());
  const annualRead = vi.fn().mockResolvedValue(packet);
  const filingsRead = vi
    .fn()
    .mockResolvedValue(filingsResponse(2, "available", eodSelection));
  const price = new ManagedEodHistory(priceRead, vi.fn(), undefined, [
    eodSelection.listing,
  ]);
  const annual = new ManagedAnnualReport(annualRead, vi.fn());
  const filings = new ManagedCompanyFilings(filingsRead, vi.fn());
  for (const model of [price, annual, filings]) model.open(eodSelection);
  await price.load();
  await annual.load();
  await filings.load();
  const evidence = companySnapshotEvidence(
    eodSelection,
    price.getSnapshot(),
    annual.getSnapshot(),
    filings.getSnapshot(),
  );
  const report = prepareCompanyReport(
    eodSelection,
    evidence,
    {
      member: { ...eodSelection.listing, note },
      canEdit: true,
      canAdd: false,
      reason: null,
    },
    now,
  )!;
  return { report, priceRead, annualRead, filingsRead };
}

describe("company research document inspection", () => {
  it("refuses accessor wrappers without reading them and keeps report and saved-watchlist purposes separate", async () => {
    const { report } = await fixture();
    const document = formatCompanyReportDocument(report)!;
    const getter = vi.fn(() => document.text);
    const accessor = { ...document };
    Object.defineProperty(accessor, "text", { enumerable: true, get: getter });
    expect(isCompanyReportDocument(accessor)).toBe(false);
    expect(getter).not.toHaveBeenCalled();
    expect(
      isCompanyReportDocument({
        version: 1,
        filename: "Investment-watchlist-v1.txt",
        text: document.text,
        byteLength: document.byteLength,
        membershipCount: 1,
      }),
    ).toBe(false);
    expect(
      formatCompanyReportDocument({ ...report, preparedAt: "invalid" }),
    ).toBeNull();
    expect(
      formatCompanyReportDocument({
        ...report,
        selection: {
          ...report.selection,
          listing: { ...report.selection.listing, symbol: "../bad" },
        },
      }),
    ).toBeNull();
  });
  it("roundtrips the exact draft and every full admitted source packet without another read", async () => {
    const f = await fixture();
    const before = structuredClone(f.report);
    const document = formatCompanyReportDocument(f.report)!;
    expect(document.purpose).toBe("investment.company-research");
    expect(document.filename).toBe(
      "Investment-research-ZERO-XNAS-20261015T000000000Z.json",
    );
    expect(isCompanyReportDocument(document)).toBe(true);
    const parsed = decode(document.text);
    expect(parsed.purpose).toBe("investment.company-research");
    expect(parsed.schemaVersion).toBe("1.0.0");
    expect(parsed.preparedAt).toBe(now().toISOString());
    expect(parsed.catalogSnapshotSha256).toBe(
      eodSelection.catalogSnapshotSha256,
    );
    expect(parsed.listing).toEqual(eodSelection.listing);
    expect(parsed.authoredResearch).toEqual({
      status: "watchlist_draft",
      note,
    });
    for (const key of ["price", "annual", "filings"] as const) {
      const state = f.report.evidence[key]!;
      expect(state.response).not.toBeNull();
      expect(parsed.sources[key]).toEqual({
        status: "loaded",
        retainedPrevious: state.showingPrevious,
        lastAttemptFailed: state.error,
        responseOrigin: state.responseOrigin,
        response: state.response,
      });
    }
    expect(parsed.sources.annual).toMatchObject({
      response: {
        evidence: {
          cashGeneration:
            f.report.evidence.annual!.response!.evidence.cashGeneration,
          liquidity: f.report.evidence.annual!.response!.evidence.liquidity,
        },
      },
    });
    expect(document.byteLength).toBe(
      new TextEncoder().encode(document.text).byteLength,
    );
    expect(document.byteLength).toBeLessThan(COMPANY_REPORT_DOCUMENT_MAX_BYTES);
    expect(formatCompanyReportDocument(f.report)).toEqual(document);
    expect(f.report).toEqual(before);
    for (const read of [f.priceRead, f.annualRead, f.filingsRead])
      expect(read).toHaveBeenCalledOnce();
  });

  it.each([null, ""])(
    "keeps the %s note state distinct without inventing authored text",
    async (value) => {
      const { report } = await fixture();
      const parsed = decode(
        formatCompanyReportDocument({ ...report, note: value })!.text,
      );
      expect(parsed.authoredResearch).toEqual({
        status: value === null ? "not_in_watchlist" : "watchlist_draft",
        note: value,
      });
    },
  );

  it("keeps missing sources distinct from loaded unavailable packets and retained previous evidence", async () => {
    const { report } = await fixture();
    const unavailable = filingsResponse(
      0,
      "upstream_unavailable",
      eodSelection,
    );
    const changed = {
      ...report,
      evidence: {
        ...report.evidence,
        price: null,
        annual: {
          ...report.evidence.annual!,
          showingPrevious: true,
          error: true,
        },
        filings: { ...report.evidence.filings!, response: unavailable },
      },
    };
    const parsed = decode(formatCompanyReportDocument(changed)!.text);
    expect(parsed.sources.price).toEqual({
      status: "not_loaded",
      lastAttemptFailed: false,
    });
    expect(parsed.sources.filings).toMatchObject({
      status: "loaded",
      response: { issuer: { status: "upstream_unavailable" } },
    });
    expect(parsed.sources.annual).toMatchObject({
      retainedPrevious: true,
      lastAttemptFailed: true,
      response: report.evidence.annual!.response,
    });
    expect(parsed.sources.annual).toMatchObject({
      response: {
        evidence: {
          generation: report.evidence.annual!.response!.evidence.generation,
        },
      },
    });
  });

  it("serializes only the chosen document fields, excluding runtime selection and operation state", async () => {
    const { report } = await fixture();
    const withRuntimeState = {
      ...report,
      operationId: "invented-operation-do-not-include",
      selection: {
        ...report.selection,
        token: "invented-token-do-not-include",
        listing: {
          ...report.selection.listing,
          note: "another-note-do-not-include",
        },
      },
      evidence: {
        ...report.evidence,
        annual: {
          ...report.evidence.annual!,
          message: "private-error-do-not-include",
        },
      },
    };
    const document = formatCompanyReportDocument(withRuntimeState)!;
    expect(document.text).not.toContain("do-not-include");
    expect(decode(document.text).authoredResearch).toEqual({
      status: "watchlist_draft",
      note,
    });
  });

  it.each(["\ud800", "x".repeat(16_384)])(
    "refuses an unrepresentable or oversized note without clipping",
    async (value) => {
      const { report } = await fixture();
      const changed = { ...report, note: value };
      expect(formatCompanyReportDocument(changed)).toBeNull();
      expect(changed.note).toBe(value);
      expect(
        renderToStaticMarkup(<CompanyReportDocumentView document={null} />),
      ).toContain("preview and draft are unchanged");
    },
  );

  it("accepts its exact UTF-8 output bound and refuses one extra byte without clipping", async () => {
    const { report } = await fixture();
    const base = formatCompanyReportDocument(report)!;
    const extra = COMPANY_REPORT_DOCUMENT_MAX_BYTES - base.byteLength;
    const issuerName = report.selection.listing.issuerName + "x".repeat(extra);
    const changed = {
      ...report,
      selection: {
        ...report.selection,
        listing: {
          ...report.selection.listing,
          issuerName,
        },
      },
    };
    expect(formatCompanyReportDocument(changed)?.byteLength).toBe(
      COMPANY_REPORT_DOCUMENT_MAX_BYTES,
    );
    expect(isCompanyReportDocument(formatCompanyReportDocument(changed))).toBe(
      true,
    );
    const oversized = {
      ...changed,
      selection: {
        ...changed.selection,
        listing: { ...changed.selection.listing, issuerName: issuerName + "x" },
      },
    };
    expect(formatCompanyReportDocument(oversized)).toBeNull();
    expect(oversized.selection.listing.issuerName).toBe(issuerName + "x");
  });

  it("starts closed, and presents an explicit read-only, labelled full JSON field when inspected", async () => {
    const { report } = await fixture();
    const closed = renderToStaticMarkup(
      <CompanyReportDocument report={report} />,
    );
    expect(closed).toContain("Inspect report document (JSON)");
    expect(closed).not.toContain("<textarea");
    expect(closed).not.toContain("<details open");
    const document = formatCompanyReportDocument(report)!;
    const open = renderToStaticMarkup(
      <CompanyReportDocumentView document={document} />,
    );
    expect(open).toContain('for="managed-report-document"');
    expect(open).toContain('id="managed-report-document"');
    expect(open).toContain('readOnly=""');
    expect(open).toContain(`${document.byteLength} UTF-8 bytes`);
    expect(open).toContain("does not download a file");
    expect(open).not.toContain("<unverified-link>");
    expect(open).toContain("&lt;unverified-link&gt;");
  });
});
