import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SecAnnualOperatingHistory } from "./SecAnnualOperatingHistory";
import { SecAnnualEvidenceResult } from "./SecAnnualEvidenceResult";
import { operatingHistoryPacket } from "./test-canonical-annual-operating-ui-fixture";
import {
  operatingResponse,
  operatingRow,
} from "./test-canonical-annual-operating-ui-fixture";
import { row, viewOf } from "./test-canonical-annual-ui-fixture";
import { parseSecAnnualCanonicalResponse } from "../../lib/sec-annual-canonical-response";

describe("reported operating history disclosure", () => {
  it("renders decoded same-filing adjacent periods, negative/zero income and complete references while initially closed", async () => {
    const raw = await operatingHistoryPacket();
    const response = await parseSecAnnualCanonicalResponse(
      raw,
      {
        schemaVersion: "6.0.0",
        catalogSnapshotSha256: raw.catalogSnapshotSha256,
        listingId: raw.security.listingId,
        symbol: raw.security.symbol,
      },
      new AbortController().signal,
    );
    expect(response).not.toBeNull();
    if (!response) throw new Error("Invented operating history was refused");
    const before = JSON.stringify(response);
    const html = renderToStaticMarkup(
      <SecAnnualOperatingHistory
        response={response}
        view={viewOf(response)}
        concept="Revenues"
      />,
    );
    expect(html).toContain(
      '<details class="managed-annual-operating-history" aria-label="Reported operating history Revenues"><summary>Reported operating history</summary>',
    );
    expect(html).toContain(
      'role="region" aria-label="Reported operating history amounts Revenues" tabindex="0"',
    );
    expect(html).toContain("Revenue · 3 periods · newest first");
    expect(html).toContain("<td>-250.125</td><td>0</td><td>80.125</td>");
    expect(html).toContain("<td>1000</td><td>800</td><td>640</td>");
    expect(html).toContain("<td>-25.01%</td><td>0%</td><td>12.52%</td>");
    expect(html).toContain('dateTime="2024-01-01"');
    expect(html).toContain("filing 0000000001-26-000001");
    expect(html).toContain("Original load completed 2026-09-20T00:00:02.000Z");
    expect(html).toContain("Earlier periods are historical comparatives");
    for (const observation of [
      ...response.evidence.facts.observations.filter(
        (item) =>
          item.concept === "OperatingIncomeLoss" || item.concept === "Revenues",
      ),
    ])
      expect(html).toContain(observation.id);
    expect(html).not.toContain("Within current-use limits");
    expect(html).not.toContain("next earlier period is unavailable");
    expect(JSON.stringify(response)).toBe(before);
  });

  it("keeps each named basis independent and explains the first missing period", async () => {
    const response = await operatingHistoryPacket();
    const render = (
      concept:
        | "SalesRevenueNet"
        | "RevenueFromContractWithCustomerExcludingAssessedTax",
    ) =>
      renderToStaticMarkup(
        <SecAnnualOperatingHistory
          response={response}
          view={viewOf(response)}
          concept={concept}
        />,
      );
    expect(render("SalesRevenueNet")).toContain(
      "Net sales revenue · 2 periods",
    );
    expect(render("SalesRevenueNet")).toContain(
      "Older periods are not substituted",
    );
    expect(render("SalesRevenueNet")).not.toContain("2023-01-01");
    expect(
      render("RevenueFromContractWithCustomerExcludingAssessedTax"),
    ).toContain("Customer contract revenue, excluding assessed tax · 1 period");
    expect(
      render("RevenueFromContractWithCustomerExcludingAssessedTax"),
    ).toContain("<td>-50.03%</td>");
  });

  it("adds histories only in managed composition without changing independent current resolution", async () => {
    const response = await operatingHistoryPacket();
    const before = JSON.stringify(viewOf(response).operatingResults.resolution);
    const managed = renderToStaticMarkup(
      <SecAnnualEvidenceResult
        response={response}
        view={viewOf(response)}
        appearance="financial"
      />,
    );
    const evidence = renderToStaticMarkup(
      <SecAnnualEvidenceResult response={response} view={viewOf(response)} />,
    );
    expect(
      managed.match(/class="managed-annual-operating-history"/g),
    ).toHaveLength(3);
    expect(evidence).not.toContain("Reported operating history");
    expect(managed).toContain(
      "Revenue and net income do not form a current-use pair",
    );
    expect(managed).toContain("Operating sources and calculation inputs");
    expect(JSON.stringify(viewOf(response).operatingResults.resolution)).toBe(
      before,
    );
  });

  it("keeps exact 64-character operands and refuses stale or absent history without hiding current amounts", async () => {
    const exact = `1.${"2".repeat(62)}`;
    const response = await operatingResponse(
      [operatingRow(exact)],
      [row("Revenues", "1000")],
    );
    expect(
      renderToStaticMarkup(
        <SecAnnualOperatingHistory
          response={response}
          view={viewOf(response)}
          concept="Revenues"
        />,
      ),
    ).toContain(`<td>${exact}</td>`);
    const stale = await operatingResponse(
      [operatingRow()],
      [row()],
      "2028-09-20T00:00:00.000Z",
    );
    const html = renderToStaticMarkup(
      <SecAnnualEvidenceResult
        response={stale}
        view={viewOf(stale)}
        appearance="financial"
      />,
    );
    expect(html).toContain("outside the current-use limits");
    expect(html).toContain("Historical value; outside current-use limits");
    expect(html).not.toContain("Reported operating history amounts");
  });
});
