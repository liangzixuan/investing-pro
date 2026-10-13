import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { resolvePersonalSecAnnualEvidence } from "@research-cockpit/personal-financial-analytics";
import {
  liquidityResponse,
  liquidityRow,
} from "./sec-annual-liquidity-fixture";
import { SecAnnualLiquidity } from "./SecAnnualLiquidity";
import { SecAnnualEvidenceResult } from "./SecAnnualEvidenceResult";

describe("Annual liquidity presentation", () => {
  it("places the optional managed note action before sources and excludes it from the local appearance", async () => {
    const wire = await liquidityResponse([
      liquidityRow("current_assets", "120.125"),
      liquidityRow("current_liabilities", "80.025"),
    ]);
    const action = <button>Add liquidity to note draft</button>;
    const managed = renderToStaticMarkup(
      <SecAnnualEvidenceResult
        response={wire}
        appearance="financial"
        liquidityAction={action}
      />,
    );
    expect(managed.indexOf("Add liquidity to note draft")).toBeGreaterThan(
      managed.indexOf("Both calculations require nonnegative"),
    );
    expect(managed.indexOf("Add liquidity to note draft")).toBeLessThan(
      managed.indexOf("<summary>Liquidity sources and calculation inputs"),
    );
    expect(managed.match(/Add liquidity to note draft/gu)).toHaveLength(1);
    expect(
      renderToStaticMarkup(
        <SecAnnualEvidenceResult response={wire} liquidityAction={action} />,
      ),
    ).not.toContain("Add liquidity to note draft");
  });

  it("labels exact reported balances and calculated units at the report date", async () => {
    const wire = await liquidityResponse([
      liquidityRow("current_assets", "120.125"),
      liquidityRow("current_liabilities", "20.025"),
    ]);
    const before = JSON.stringify(wire);
    const html = renderToStaticMarkup(<SecAnnualLiquidity response={wire} />);
    expect(html).toContain("<caption>Balances at 2025-12-31</caption>");
    expect(html).toContain(
      'aria-label="Annual liquidity results" tabindex="0"',
    );
    expect(html).toContain("Current assets<small>Reported · USD</small>");
    expect(html).toContain("Current liabilities<small>Reported · USD</small>");
    expect(html).toContain(
      "Working capital<small>App calculation · USD</small>",
    );
    expect(html).toContain(
      "Current ratio<small>App calculation · multiple</small>",
    );
    for (const value of ["120.125", "20.025", "100.1", "6.00×"])
      expect(html).toContain(`class="sec-annual-liquidity-amount">${value}<`);
    expect(html).toContain("two decimal places, half up");
    expect(html).not.toContain("2025-01-01 to");
    expect(html).not.toContain("Inclusive duration");
    expect(html).not.toContain("Unknown start");
    expect(html).not.toContain("<button");
    expect(JSON.stringify(wire)).toBe(before);
  });

  it("keeps original clocks, filing joins, source pointers and calculation references inspectable", async () => {
    const wire = await liquidityResponse([
      liquidityRow("current_assets", "150"),
      liquidityRow("current_liabilities", "100"),
    ]);
    const html = renderToStaticMarkup(<SecAnnualLiquidity response={wire} />);
    expect(html).not.toContain("<details open");
    expect(html).toContain(
      "<summary>Liquidity sources and calculation inputs</summary>",
    );
    expect(html).toContain("Annual cutoff 2026-09-20T00:00:00.000Z");
    expect(html).toContain("Company Facts captured 2026-09-20T00:00:01.000Z");
    expect(html).toContain("Submissions captured 2026-09-20T00:00:02.000Z");
    expect(html).toContain("Completed 2026-09-20T00:00:02.000Z");
    expect(html).toContain(
      "Not supplied; an instant balance requires no duration.",
    );
    expect(html).toContain("Filing focus, not balance year");
    const balances = wire.evidence.liquidity;
    for (const metric of [
      balances.currentAssets,
      balances.currentLiabilities,
    ]) {
      for (const item of metric.observations) {
        for (const field of [
          item.id,
          item.concept,
          item.sourceLocator,
          item.accessionNumber,
          item.filing.acceptedAt!,
        ])
          expect(html).toContain(field);
        expect(html).toContain(
          `href="${item.filing.sourceUrl}" target="_blank" rel="noreferrer"`,
        );
      }
    }
    expect(html).toContain(
      `Working capital references: ${balances.resolution.workingCapital.observationIds.join(" · ")}`,
    );
    expect(html).toContain(
      `Current ratio references: ${balances.resolution.currentRatio.observationIds.join(" · ")}`,
    );
  });

  it.each([
    {
      assets: "0",
      liabilities: "20",
      values: ["0", "20", "-20", "0.00×"],
      refusal: null,
    },
    {
      assets: "10",
      liabilities: "0",
      values: ["10", "0"],
      refusal: "Current ratio requires current liabilities greater than zero.",
    },
    {
      assets: "-10",
      liabilities: "20",
      values: ["-10", "20"],
      refusal: "This calculation requires nonnegative reported balances.",
    },
    {
      assets: "10",
      liabilities: "-20",
      values: ["10", "-20"],
      refusal: "This calculation requires nonnegative reported balances.",
    },
  ])(
    "preserves zero and signed observations ($assets / $liabilities)",
    async ({ assets, liabilities, values, refusal }) => {
      const wire = await liquidityResponse([
        liquidityRow("current_assets", assets),
        liquidityRow("current_liabilities", liabilities),
      ]);
      const html = renderToStaticMarkup(<SecAnnualLiquidity response={wire} />);
      for (const value of values)
        expect(html).toContain(`class="sec-annual-liquidity-amount">${value}<`);
      if (refusal) expect(html).toContain(`Unavailable. ${refusal}`);
      else expect(html).not.toContain("Unavailable.");
    },
  );

  it("keeps the independent amount when the other concept is absent, without inventing zero", async () => {
    const wire = await liquidityResponse([
      liquidityRow("current_assets", "75"),
    ]);
    const html = renderToStaticMarkup(<SecAnnualLiquidity response={wire} />);
    expect(html).toContain('class="sec-annual-liquidity-amount">75<');
    expect(html).toContain(
      "Unavailable. This reported balance concept is absent from the source.",
    );
    expect(html).not.toContain('class="sec-annual-liquidity-amount">0<');
    expect(html).not.toContain("undefined");
  });

  it("explains a refused duration observation while preserving its actual source period", async () => {
    const wire = await liquidityResponse([
      liquidityRow("current_assets", "75", {
        startDate: "2025-01-01",
        durationDays: 365,
      }),
      liquidityRow("current_liabilities", "25"),
    ]);
    const html = renderToStaticMarkup(<SecAnnualLiquidity response={wire} />);
    expect(html).toContain(
      "Unavailable. The source observation has a period rather than a balance at one date.",
    );
    expect(html).toContain("<dt>Source start date</dt><dd>2025-01-01</dd>");
    expect(html).toContain("365 days; not an instant balance.");
    expect(html).toContain("AssetsCurrent · Source end 2025-12-31 · 75 USD");
    expect(html).not.toContain('class="sec-annual-liquidity-amount">75<');
    expect(html).toContain('class="sec-annual-liquidity-amount">25<');
  });

  it("preserves complete long derived values and historical qualifications", async () => {
    const wire = await liquidityResponse(
      [
        liquidityRow("current_assets", "9".repeat(64)),
        liquidityRow("current_liabilities", `0.${"0".repeat(61)}1`),
      ],
      "2028-09-20T00:00:00.000Z",
    );
    const html = renderToStaticMarkup(<SecAnnualLiquidity response={wire} />);
    const { workingCapital, currentRatio } = wire.evidence.liquidity.resolution;
    expect(workingCapital.status).toBe("available");
    expect(currentRatio.status).toBe("available");
    if (
      workingCapital.status !== "available" ||
      currentRatio.status !== "available"
    )
      throw new Error("Expected available historical calculations");
    expect(workingCapital.value).toHaveLength(127);
    expect(currentRatio.value).toHaveLength(129);
    expect(html).toContain(
      `class="sec-annual-liquidity-amount">${workingCapital.value}<`,
    );
    expect(html).toContain(
      `class="sec-annual-liquidity-amount">${currentRatio.value}×<`,
    );
    expect(html).toContain(
      "Historical value; outside current-use limits at this load.",
    );
    expect(html).toContain("At 2025-12-31");
    expect(html).toContain(
      "within 485 days and source captures within seven days",
    );
    const negative = await liquidityResponse([
      liquidityRow("current_assets", `0.${"0".repeat(61)}1`),
      liquidityRow("current_liabilities", "9".repeat(64)),
    ]);
    const negativeCapital =
      negative.evidence.liquidity.resolution.workingCapital;
    if (negativeCapital.status !== "available")
      throw new Error("Expected negative working capital");
    expect(negativeCapital.value).toHaveLength(128);
    expect(
      renderToStaticMarkup(<SecAnnualLiquidity response={negative} />),
    ).toContain(
      `class="sec-annual-liquidity-amount">${negativeCapital.value}<`,
    );
  });

  it("places liquidity after cash in the managed view even when income and cash are unavailable", async () => {
    const wire = await liquidityResponse([
      liquidityRow("current_assets", "150"),
      liquidityRow("current_liabilities", "100"),
    ]);
    const evidence = {
      ...wire.evidence,
      incomeScanStatus: "invalid_response" as const,
      coverage: null,
      observations: [],
      completeness: {
        status: "refused" as const,
        reason: "source_unavailable" as const,
      },
    };
    const packet = {
      ...wire,
      evidence: {
        ...evidence,
        resolution: resolvePersonalSecAnnualEvidence(evidence),
      },
    };
    const html = renderToStaticMarkup(
      <SecAnnualEvidenceResult response={packet} appearance="financial" />,
    );
    expect(html).toContain("Revenue and net income withheld");
    expect(html.indexOf("Liquidity at fiscal year-end")).toBeGreaterThan(
      html.indexOf("Cash sources and calculation inputs"),
    );
    expect(html).toContain('class="sec-annual-liquidity-amount">1.50×<');
    const local = renderToStaticMarkup(
      <SecAnnualEvidenceResult response={packet} />,
    );
    expect(local).not.toContain("Liquidity at fiscal year-end");
    expect(local).toContain("Cash sources and calculation inputs");
  });
});
