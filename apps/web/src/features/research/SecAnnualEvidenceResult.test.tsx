import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SecAnnualEvidenceResult } from "./SecAnnualEvidenceResult";
import { response, row } from "./sec-annual-evidence-fixture";

describe("shared annual result", () => {
  it("retains signed values, separate revenue concepts and inspectable provenance", async () => {
    const wire = await response([
      row("Revenues", "1000"),
      row("SalesRevenueNet", "900"),
      row("NetIncomeLoss", "-25"),
    ]);
    const html = renderToStaticMarkup(
      <SecAnnualEvidenceResult response={wire} />,
    );
    expect(html).toContain("Net income · USD");
    expect(html).toContain(">-25</dd>");
    expect(html).toContain(">-2.5</dd>");
    expect(html).toContain('aria-label="Annual revenue basis SalesRevenueNet"');
    expect(html).toContain('aria-label="Annual revenue basis Revenues"');
    expect(html).toContain("Inspect selected-report evidence (3 observations)");
    expect(html).toContain(wire.evidence.generation.sha256);
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toContain("Load observed annual report");
  });

  it("keeps complete coverage distinct from a missing pair and current-use refusal", async () => {
    const wire = await response([row()]);
    const html = renderToStaticMarkup(
      <SecAnnualEvidenceResult response={wire} />,
    );
    expect(html).toContain("Complete for the four requested USD concepts");
    expect(html).toContain("No valid annual pair");
    expect(html).toContain("Unavailable under the current-use policy");
    expect(html).toContain(
      "NetIncomeLoss is missing for this filing and exact period",
    );
    expect(html).not.toContain("Net margin · %</dt>");
  });
});
