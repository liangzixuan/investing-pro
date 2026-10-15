import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SecAnnualLiquidityHistory } from "./SecAnnualLiquidityHistory";
import { SecAnnualLiquidity } from "./SecAnnualLiquidity";
import { SecAnnualEvidenceResult } from "./SecAnnualEvidenceResult";
import {
  liquidityResponse,
  liquidityRow,
} from "./sec-annual-liquidity-fixture";
import { parseSecAnnualEvidenceResponse } from "../../lib/sec-annual-evidence-response";

function reportedDates() {
  return (
    [
      ["2025-12-31", "1500", "600"],
      ["2024-06-30", "10", "0"],
      ["2022-02-28", "-5", "20"],
    ] as const
  ).flatMap(([endDate, assets, liabilities], index) => [
    liquidityRow("current_assets", assets, {
      endDate,
      sourceLocator: `/facts/us-gaap/AssetsCurrent/units/USD/${index}`,
    }),
    liquidityRow("current_liabilities", liabilities, {
      endDate,
      sourceLocator: `/facts/us-gaap/LiabilitiesCurrent/units/USD/${index}`,
    }),
  ]);
}

describe("reported liquidity history presentation", () => {
  it("renders decoded exact dates, raw balances, independent calculation refusals and all agreeing references inside a closed disclosure", async () => {
    const raw = await liquidityResponse([
      ...reportedDates(),
      liquidityRow("current_assets", "1500", {
        frame: null,
        sourceLocator: "/facts/us-gaap/AssetsCurrent/units/USD/3",
      }),
    ]);
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
    expect(response).not.toBeNull();
    if (!response)
      throw new Error("Invented reported liquidity dates were refused");
    const before = JSON.stringify(response);
    const html = renderToStaticMarkup(
      <SecAnnualLiquidityHistory response={response} />,
    );
    expect(html).toContain(
      '<details class="managed-annual-liquidity-history"><summary>Reported liquidity history</summary>',
    );
    expect(html).toContain(
      'role="region" aria-label="Reported liquidity history balances" tabindex="0"',
    );
    expect(html).toContain("Reported balances · 3 dates · newest first");
    for (const date of ["2025-12-31", "2024-06-30", "2022-02-28"])
      expect(html).toContain(
        `<th scope="col"><time dateTime="${date}">${date}</time></th>`,
      );
    expect(html).toContain(
      "Current assets<small>Reported · USD</small></th><td>1500</td><td>10</td><td>-5</td>",
    );
    expect(html).toContain(
      "Current liabilities<small>Reported · USD</small></th><td>600</td><td>0</td><td>20</td>",
    );
    expect(html).toContain(
      "Working capital<small>App calculation · USD</small></th><td>900</td><td>10</td>",
    );
    expect(html).toContain(
      "Current ratio<small>App calculation · multiple</small></th><td>2.50×</td>",
    );
    expect(html).toContain(
      "Unavailable. Current ratio requires current liabilities greater than zero.",
    );
    expect(html).toContain(
      "Unavailable. This calculation requires nonnegative reported balances.",
    );
    expect(html).toContain(
      "These dates need not be consecutive fiscal year-ends",
    );
    expect(html).toContain("Earlier dates are historical comparatives");
    expect(html).toContain(
      'Selected filing report date <time dateTime="2025-12-31">2025-12-31</time>',
    );
    expect(html).toContain("filing 0000000001-26-000001");
    expect(html).toContain("Original Annual cutoff 2026-09-20T00:00:00.000Z");
    expect(html).toContain("Company Facts captured 2026-09-20T00:00:01.000Z");
    expect(html).toContain("Submissions captured 2026-09-20T00:00:02.000Z");
    expect(html).toContain("Original load completed 2026-09-20T00:00:02.000Z");
    expect(html).toContain("Liquidity sources and calculation inputs");
    for (const metric of [
      response.evidence.liquidity.currentAssets,
      response.evidence.liquidity.currentLiabilities,
    ])
      for (const observation of metric.observations)
        expect(html).toContain(observation.id);
    expect(html).not.toContain("Within current-use limits");
    expect(html).not.toContain("History stops at");
    expect(html).not.toContain("adjacent annual");
    expect(JSON.stringify(response)).toBe(before);
  });

  it("shows the actual first blocked date and refusal without substituting an older complete pair", async () => {
    const response = await liquidityResponse(
      reportedDates()
        .filter(
          (row) =>
            !(
              row.metric === "current_liabilities" &&
              row.endDate === "2024-06-30"
            ),
        )
        .map((row) =>
          row.metric === "current_liabilities" && row.endDate === "2022-02-28"
            ? {
                ...row,
                sourceLocator: "/facts/us-gaap/LiabilitiesCurrent/units/USD/1",
              }
            : row,
        ),
    );
    const html = renderToStaticMarkup(
      <SecAnnualLiquidityHistory response={response} />,
    );
    expect(html).toContain("Reported balances · 1 date · newest first");
    expect(html).toContain(
      'History stops at reported balance date <time dateTime="2024-06-30">2024-06-30</time>',
    );
    expect(html).toContain(
      "One or both reported balances are missing at the required date.",
    );
    expect(html).toContain("Older dates are not substituted.");
    expect(html).not.toContain("2022-02-28");
    expect(html).not.toContain("<td>-5</td>");
  });

  it("keeps current-only history truthful without inventing a missing earlier date", async () => {
    const response = await liquidityResponse(
      reportedDates().filter((row) => row.endDate === "2025-12-31"),
    );
    const html = renderToStaticMarkup(
      <SecAnnualLiquidityHistory response={response} />,
    );
    expect(html).toContain("Reported balances · 1 date · newest first");
    expect(html).not.toContain("History stops at");
    expect(html).not.toContain("2024-06-30");
    expect(html).toContain("do not establish a complete timeline");
  });

  it("retains full 64-character balances, 128-character working capital and 129-character ratio", async () => {
    const large = "9".repeat(64);
    const tiny = `0.${"0".repeat(61)}1`;
    const negativeWorkingCapital = `-${"9".repeat(63)}8.${"9".repeat(62)}`;
    const largeRatio = `${large}${"0".repeat(62)}.00`;
    expect(large).toHaveLength(64);
    expect(tiny).toHaveLength(64);
    expect(negativeWorkingCapital).toHaveLength(128);
    expect(largeRatio).toHaveLength(129);
    const negative = await liquidityResponse([
      liquidityRow("current_assets", tiny),
      liquidityRow("current_liabilities", large),
    ]);
    const ratio = await liquidityResponse([
      liquidityRow("current_assets", large),
      liquidityRow("current_liabilities", tiny),
    ]);
    const negativeHtml = renderToStaticMarkup(
      <SecAnnualLiquidityHistory response={negative} />,
    );
    const ratioHtml = renderToStaticMarkup(
      <SecAnnualLiquidityHistory response={ratio} />,
    );
    expect(negativeHtml).toContain(`<td>${tiny}</td>`);
    expect(negativeHtml).toContain(`<td>${large}</td>`);
    expect(negativeHtml).toContain(`<td>${negativeWorkingCapital}</td>`);
    expect(ratioHtml).toContain(`<td>${largeRatio}×</td>`);
  });

  it("adds only the managed history slot while preserving current results, note action and complete source body", async () => {
    const response = await liquidityResponse(reportedDates());
    const before = JSON.stringify(response.evidence.liquidity.resolution);
    const managed = renderToStaticMarkup(
      <SecAnnualEvidenceResult
        response={response}
        appearance="financial"
        liquidityAction={<button>Keep current liquidity note</button>}
      />,
    );
    const evidence = renderToStaticMarkup(
      <SecAnnualEvidenceResult response={response} />,
    );
    const plain = renderToStaticMarkup(
      <SecAnnualLiquidity response={response} />,
    );
    const explicit = renderToStaticMarkup(
      <SecAnnualLiquidity
        response={response}
        history={<p>Explicit history slot</p>}
      />,
    );
    expect(
      managed.match(/class="managed-annual-liquidity-history"/g),
    ).toHaveLength(1);
    expect(evidence).not.toContain("Reported liquidity history");
    expect(plain).not.toContain("Reported liquidity history");
    expect(explicit).toContain("Explicit history slot");
    expect(managed.indexOf("Keep current liquidity note")).toBeLessThan(
      managed.indexOf("Reported liquidity history"),
    );
    expect(managed.indexOf("Reported liquidity history")).toBeLessThan(
      managed.indexOf("<summary>Liquidity sources and calculation inputs"),
    );
    for (const html of [managed, plain])
      expect(html).toContain("Liquidity sources and calculation inputs");
    expect(JSON.stringify(response.evidence.liquidity.resolution)).toBe(before);
  });

  it("explains unavailable history without hiding historical or independently available current balances", async () => {
    const stale = await liquidityResponse(
      reportedDates(),
      "2028-09-20T00:00:00.000Z",
    );
    const missing = await liquidityResponse(
      reportedDates().filter((row) => row.metric === "current_assets"),
    );
    const staleHtml = renderToStaticMarkup(
      <SecAnnualEvidenceResult response={stale} appearance="financial" />,
    );
    const missingHtml = renderToStaticMarkup(
      <SecAnnualEvidenceResult response={missing} appearance="financial" />,
    );
    expect(staleHtml).toContain("Liquidity history unavailable.");
    expect(staleHtml).toContain(
      "selected liquidity report is outside the current-use limits",
    );
    expect(staleHtml).toContain(
      "Historical value; outside current-use limits at this load.",
    );
    expect(staleHtml).not.toContain("Reported liquidity history balances");
    expect(missingHtml).toContain(
      "This reported balance concept is absent from the source.",
    );
    expect(missingHtml).toContain('class="sec-annual-liquidity-amount">1500<');
    expect(missingHtml).not.toContain("Reported liquidity history balances");
  });
});
