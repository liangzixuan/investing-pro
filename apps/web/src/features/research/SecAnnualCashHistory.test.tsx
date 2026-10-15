import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SecAnnualCashHistory } from "./SecAnnualCashHistory";
import { SecAnnualEvidenceResult } from "./SecAnnualEvidenceResult";
import {
  annualCashHistoryRows,
  cashResponse,
  cashGeneration,
} from "./sec-annual-cash-fixture";
import { parseSecAnnualEvidenceResponse } from "../../lib/sec-annual-evidence-response";
import { response as annualResponse } from "./sec-annual-evidence-fixture";
import { ManagedAnnualReport } from "../../clerk-trial/managed-annual-report";
import { eodSelection } from "../../clerk-trial/eod-history-fixture";
import { TrialApiError } from "../../clerk-trial/api";
import type { ManagedApi } from "../../clerk-trial/managed-api";

describe("reported cash history", () => {
  it("renders three decoded same-filing periods and all references inside an initially closed disclosure", async () => {
    const raw = await cashResponse(annualCashHistoryRows());
    const response = await parseSecAnnualEvidenceResponse(
      raw,
      {
        schemaVersion: "4.0.0",
        catalogSnapshotSha256: raw.catalogSnapshotSha256,
        listingId: raw.security.listingId,
        symbol: raw.security.symbol,
      },
      new AbortController().signal,
    );
    if (response === null)
      throw new Error("Invented cash history packet was refused");
    const before = JSON.stringify(response);
    const html = renderToStaticMarkup(
      <SecAnnualCashHistory response={response} />,
    );
    expect(html).toContain(
      '<details class="managed-annual-cash-history"><summary>Reported cash history</summary>',
    );
    expect(html).toContain(
      'role="region" aria-label="Reported cash history amounts" tabindex="0"',
    );
    expect(html).toContain("Annual cash amounts · 3 periods · newest first");
    expect(html).toContain('<time dateTime="2024-01-01">2024-01-01</time>');
    expect(html).toContain("<td>120.125</td><td>-50</td><td>500</td>");
    expect(html).toContain("<td>20.025</td><td>0</td><td>750</td>");
    expect(html).toContain("<td>100.1</td><td>-50</td><td>-250</td>");
    expect(html).toContain("App calculation");
    expect(html).toContain("2026-09-20T00:00:02.000Z");
    expect(html).toContain("filing 0000000001-26-000001");
    expect(html).toContain("Earlier periods are historical comparatives");
    for (const metric of [
      response.evidence.cashGeneration.operatingCashFlow,
      response.evidence.cashGeneration.ppePurchases,
    ])
      for (const row of metric.observations) expect(html).toContain(row.id);
    expect(html).not.toContain("Within current-use limits");
    expect(html).not.toContain("next earlier period is unavailable");
    expect(JSON.stringify(response)).toBe(before);
  });

  it("preserves a valid prefix when the immediately preceding period is missing", async () => {
    const response = await cashResponse(
      annualCashHistoryRows().filter((row) => row.endDate !== "2024-12-31"),
    );
    const html = renderToStaticMarkup(
      <SecAnnualCashHistory response={response} />,
    );
    expect(html).toContain("Annual cash amounts · 1 period · newest first");
    expect(html).toContain("The next earlier period is unavailable.");
    expect(html).toContain("Older periods are not substituted.");
    expect(html).not.toContain("<td>500</td>");
    expect(html).not.toContain("2023-01-01");
  });

  it("explains a prior observation's filing-date mismatch without rejecting valid comparative dates", async () => {
    const response = await cashResponse(
      annualCashHistoryRows().map((row) =>
        row.endDate === "2024-12-31"
          ? { ...row, filing: { ...row.filing, reportDate: "2024-12-31" } }
          : row,
      ),
    );
    const html = renderToStaticMarkup(
      <SecAnnualCashHistory response={response} />,
    );
    expect(html).toContain("Annual cash amounts · 1 period");
    expect(html).toContain(
      "The observation’s filing report date does not match the selected filing.",
    );
    expect(html).not.toContain("The observation ends outside");
  });

  it("keeps current historical values while refusing out-of-policy paired history", async () => {
    const response = await cashResponse(
      annualCashHistoryRows(),
      "2028-09-20T00:00:00.000Z",
    );
    const html = renderToStaticMarkup(
      <SecAnnualEvidenceResult response={response} appearance="financial" />,
    );
    expect(html).toContain("Cash history unavailable.");
    expect(html).toContain("outside the current-use limits");
    expect(html).toContain(
      "Historical amount; outside current-use limits at this load.",
    );
    expect(html).toContain("120.125");
    expect(html).not.toContain("Reported cash history amounts");
  });

  it("adds managed history without changing evidence appearance or independent current cash", async () => {
    const response = await cashResponse(annualCashHistoryRows());
    const currentBefore = JSON.stringify(
      response.evidence.cashGeneration.resolution,
    );
    const managed = renderToStaticMarkup(
      <SecAnnualEvidenceResult response={response} appearance="financial" />,
    );
    const evidence = renderToStaticMarkup(
      <SecAnnualEvidenceResult response={response} />,
    );
    expect(managed).toContain("Reported cash history");
    expect(evidence).not.toContain("Reported cash history");
    expect(managed).toContain("Cash sources and calculation inputs");
    expect(evidence).toContain("Cash sources and calculation inputs");
    expect(JSON.stringify(response.evidence.cashGeneration.resolution)).toBe(
      currentBefore,
    );
  });
  it("shows cash history independently of missing income", async () => {
    const base = await annualResponse([]);
    const response = {
      ...base,
      evidence: {
        ...base.evidence,
        cashGeneration: await cashGeneration(
          base.evidence,
          annualCashHistoryRows(),
        ),
      },
    };
    const html = renderToStaticMarkup(
      <SecAnnualEvidenceResult response={response} appearance="financial" />,
    );
    expect(html).toContain("Annual cash amounts · 3 periods");
    expect(html).toContain(
      "Revenue and net income do not form a current-use pair",
    );
    expect(html).toContain("<td>-250</td>");
  });

  it("retains history after a failed refresh, replaces its prefix on acceptance and removes it on retirement", async () => {
    const initial = await cashResponse(annualCashHistoryRows());
    const replacement = await cashResponse(
      annualCashHistoryRows().filter((row) => row.endDate === "2025-12-31"),
    );
    const read = vi
      .fn<ManagedApi["annualReport"]>()
      .mockResolvedValueOnce(initial)
      .mockRejectedValueOnce(new TrialApiError("unavailable"))
      .mockResolvedValueOnce(replacement);
    const model = new ManagedAnnualReport(read, vi.fn());
    model.open({ ...eodSelection, origin: "watchlist", cik: null });
    const html = () => {
      const response = model.getSnapshot().response;
      return response
        ? renderToStaticMarkup(<SecAnnualCashHistory response={response} />)
        : "";
    };
    await model.load();
    expect(html()).toContain("Annual cash amounts · 3 periods");
    await model.load();
    expect(model.getSnapshot().showingPrevious).toBe(true);
    expect(html()).toContain("Annual cash amounts · 3 periods");
    expect(model.getSnapshot().response?.evidence.generation.completedAt).toBe(
      initial.evidence.generation.completedAt,
    );
    await model.load();
    expect(model.getSnapshot().showingPrevious).toBe(false);
    expect(html()).toContain("Annual cash amounts · 1 period");
    expect(html()).not.toContain("2023-01-01");
    expect(read).toHaveBeenCalledTimes(3);
    model.retire();
    expect(html()).toBe("");
    expect(read).toHaveBeenCalledTimes(3);
  });
});
