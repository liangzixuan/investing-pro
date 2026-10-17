import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY as registry,
  type PersonalSecAnnualStatementObservationDto,
} from "@research-cockpit/contracts";
import { resolvePersonalSecAnnualStatements } from "@research-cockpit/personal-financial-analytics";
import {
  fixture,
  observation,
  setScan,
} from "../../../../packages/personal-financial-analytics/src/personal-sec-annual-statements.fixture";
import { AnnualStatementsReportView } from "./AnnualStatementsReportView";

const exact = "9007199254740993123456789.012345678901234567";
const prior = "2024-09-30";

function render(rows: readonly PersonalSecAnnualStatementObservationDto[]) {
  const evidence = fixture(rows);
  const statements = resolvePersonalSecAnnualStatements(evidence);
  return {
    evidence,
    statements,
    html: renderToStaticMarkup(
      <AnnualStatementsReportView
        evidence={evidence}
        statements={statements}
      />,
    ),
  };
}
function allRows() {
  return registry.flatMap((entry) => [
    observation(entry.concept, 0, {
      value:
        entry.concept === "StockholdersEquity" ||
        entry.concept === "NetCashProvidedByUsedInInvestingActivities"
          ? `-${exact}`
          : exact,
    }),
    observation(entry.concept, 1, {
      value: "0",
      endDate: prior,
      startDate: entry.periodType === "instant" ? null : "2023-10-01",
    }),
    ...(entry.periodType === "duration"
      ? [
          observation(entry.concept, 2, {
            value: "7.25",
            endDate: "2023-09-30",
            startDate: "2022-10-01",
          }),
        ]
      : []),
  ]);
}
function text(value: string) {
  return renderToStaticMarkup(<>{value}</>);
}

describe("static annual statement report", () => {
  it("renders all three statements, all 32 lines and every canonical observation once, including undisplayed earlier dates", () => {
    const rows = [
      ...allRows(),
      observation("NetIncomeLoss", 3, {
        value: "-123.456789",
        startDate: "2021-10-01",
        endDate: "2022-09-30",
      }),
    ];
    const { evidence, statements, html } = render(rows);
    expect(html).toContain('aria-label="Income statement report"');
    expect(html).toContain('aria-label="Balance sheet report"');
    expect(html).toContain('aria-label="Cash flow report"');
    expect(html.match(/<th scope="row"/gu)).toHaveLength(32);
    expect(html.match(/<caption>/gu)).toHaveLength(3);
    expect(html.match(/<dt>Concept scan<\/dt>/gu)).toHaveLength(32);
    expect(html.match(/<dt>Scan coverage<\/dt>/gu)).toHaveLength(32);
    expect(
      html.match(/class="managed-annual-statement-observation"/gu),
    ).toHaveLength(rows.length);
    for (const entry of registry) expect(html).toContain(text(entry.label));
    for (const row of evidence.facts.observations) {
      expect(html.split(text(row.sourceLocator))).toHaveLength(2);
      expect(html).toContain(row.id);
      expect(html).toContain(`USD ${row.value}`);
    }
    expect(html).toContain(`USD -${exact}`);
    expect(html).toContain("USD 0");
    expect(html).toContain("2023-10-01 through 2024-09-30");
    expect(html).toContain("Historical comparative");
    expect(html).toContain(
      "Historical value; not eligible for current use at this load.",
    );
    expect(html).toContain("2021-10-01 through 2022-09-30");
    expect(
      statements.statements
        .flatMap((s) => s.columns)
        .some((c) => c.endDate === "2022-09-30"),
    ).toBe(false);
    expect(
      html.match(/Inspect filing and original source references/gu),
    ).toHaveLength(1);
    expect(html.match(/<dt>Generation digest<\/dt>/gu)).toHaveLength(1);
    expect(html).toContain(evidence.generation.cutoffAt);
    expect(html).toContain(evidence.generation.completedAt);
    expect(html).toContain(evidence.generation.sources.companyFacts.fetchedAt!);
    expect(html).toContain(evidence.generation.sources.submissions.fetchedAt!);
    expect(html).toContain("2026-02-01T16:00:00.000Z");
    expect(html).toContain("unique observations;");
    expect(html).toContain("observations from other accessions.");
  });
  it("has no note choices, selectors, dead actions or raw JSON while disclosures remain readable", () => {
    const { html } = render(allRows());
    expect(html).not.toMatch(/<(?:input|select|button|textarea)\b/gu);
    expect(html).not.toContain("Select for note");
    expect(html).not.toContain("Selection does not add or save a note.");
    expect(html).not.toContain("<pre");
    expect(html).not.toContain("<details open");
    expect(html).toContain("Inspect Net sales revenue (legacy basis)");
    expect(html).toContain("Legacy basis, deprecated 2018-01-31");
    expect(html).toContain(
      "Excludes temporary equity and noncontrolling interests.",
    );
    expect(html).toContain("Not comprehensive capital expenditure");
  });
  it("keeps independent missing, conflicting and scan-limit refusals beside exact available balances and flows", () => {
    const evidence = fixture([
      observation("Revenues", 0, { value: exact }),
      observation("GrossProfit", 0, { value: "11" }),
      observation("GrossProfit", 1, { value: "12" }),
      observation("StockholdersEquity", 0, { value: "-7.500000000000000001" }),
      observation("NetCashProvidedByUsedInOperatingActivities", 0, {
        value: "120.125",
      }),
    ]);
    setScan(evidence, "InventoryNet", {
      status: "candidate_limit",
      absence: null,
      coverage: null,
    });
    const tax = evidence.facts.scans.find(
      (s) => s.concept === "IncomeTaxExpenseBenefit",
    )!.scan;
    if (tax.status !== "available")
      throw new Error("Fixture scan must be available");
    setScan(evidence, "IncomeTaxExpenseBenefit", {
      ...tax,
      absence: "usd_missing",
    });
    const statements = resolvePersonalSecAnnualStatements(evidence);
    const html = renderToStaticMarkup(
      <AnnualStatementsReportView
        evidence={evidence}
        statements={statements}
      />,
    );
    expect(html).toContain("Reported observations disagree on the amount.");
    expect(html).toContain("This exact concept is absent from Company Facts.");
    expect(html).toContain("This concept has no reported USD observations.");
    expect(html).toContain("The concept exceeds the source scan limit.");
    for (const amount of [
      exact,
      "11",
      "12",
      "-7.500000000000000001",
      "120.125",
    ])
      expect(html).toContain(`USD ${amount}`);
    expect(
      html.match(/class="managed-annual-statement-observation"/gu),
    ).toHaveLength(5);
    expect(html).not.toContain("<input");
  });
  it("escapes hostile source text without creating executable markup or links", () => {
    const hostile =
      '</summary><script>alert("source")</script><img src=x onerror=alert(1)>';
    const { html } = render([
      observation("Revenues", 0, { frame: hostile, value: exact }),
    ]);
    expect(html).toContain(text(hostile));
    expect(html).not.toMatch(/<(?:script|img|iframe|a)\b/gu);
    expect(html).toContain(`USD ${exact}`);
    expect(html).toContain("https://www.sec.gov/Archives/edgar/data/42/");
  });
  it("retains all concept scan inspections when no annual target can form dates", () => {
    const evidence = fixture();
    evidence.target = {
      status: "unresolved",
      reason: "no_observed_annual_target",
    };
    for (const entry of evidence.facts.scans)
      if (entry.scan.status === "available")
        Object.assign(entry.scan.coverage, {
          selected: null,
          otherAccessions: null,
          omittedSelected: null,
        });
    const statements = resolvePersonalSecAnnualStatements(evidence);
    const html = renderToStaticMarkup(
      <AnnualStatementsReportView
        evidence={evidence}
        statements={statements}
      />,
    );
    expect(html).toContain(
      "Statement availability: An annual filing could not be selected.",
    );
    expect(
      html.match(/No admitted statement dates are available for this load./gu),
    ).toHaveLength(3);
    expect(html.match(/<dt>Concept scan<\/dt>/gu)).toHaveLength(32);
    for (const entry of registry)
      expect(html).toContain(`us-gaap:${entry.concept} · USD`);
    expect(html).not.toContain("<table");
    expect(html).not.toContain("<input");
    expect(html).not.toContain("<select");
  });
});
