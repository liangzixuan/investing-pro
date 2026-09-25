import type {
  PersonalAnnualFinancialReportedFieldKeyDto,
  PersonalAnnualFinancialReportedValuesDto,
  PersonalAnnualFinancialsDto,
} from "@research-cockpit/contracts";
import {
  buildPersonalFinancialQualityScorecard,
  PERSONAL_FINANCIAL_REPORTED_FIELDS,
} from "@research-cockpit/personal-financial-analytics";
import { buildPersonalManualPeerComparison } from "@research-cockpit/personal-market-analytics";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  PersonalManualPeerQualityComparison,
  type PersonalManualPeerQualityCompanyInput,
  type PersonalManualPeerQualityComparisonProps,
} from "./PersonalManualPeerQualityComparison";
import { mapAnnualFinancials } from "./personal-financial-quality-input";

describe("PersonalManualPeerQualityComparison", () => {
  it("shortens a repeating peer ratio with nested keyboard-accessible full calculation details", () => {
    const companies = [
      company(0),
      company(1, { current_assets: "1", current_liabilities: "3" }),
    ];
    const expected = buildPersonalFinancialQualityScorecard(
      mapAnnualFinancials(companies[1]!.annualFinancials!),
    );
    expect(expected.status).toBe("ready");
    if (expected.status !== "ready") throw Error("Fixture rejected");
    const check = expected.groups
      .flatMap((group) => group.checks)
      .find((item) => item.label.includes("Current ratio"))!;
    const row = qualityRows(render(companies)).find((item) =>
      text(item.label).includes("Current ratio"),
    )!;
    const cell = row.cells[1]!;
    expect(text(cell)).toContain("≈ 0.3333 ratio");
    expect(cell).toContain(
      '<details class="financial-ratio-details"><summary>Calculation details</summary>',
    );
    expect(cell).toContain(
      `<p class="financial-exact-value">${check.currentObservation!.value!} ratio</p>`,
    );
    expect(cell).not.toContain('<details class="financial-ratio-details" open');
    expect(cell).toContain(`data-status="${check.status}"`);
    expect(text(cell)).toContain("2029:current_assets");
    expect(text(cell)).toContain("2029-12-31");
  });
  it.each([2, 3, 4])(
    "matches all twelve real-engine checks across %i ordered companies",
    (count) => {
      const companies = Array.from({ length: count }, (_, index) =>
        company(index),
      );
      const markup = render(companies);
      const rows = qualityRows(markup);
      expect(rows).toHaveLength(12);
      for (let index = 0; index < companies.length; index++) {
        const source = companies[index]!.annualFinancials!;
        const expected = buildPersonalFinancialQualityScorecard(
          mapAnnualFinancials(source),
        );
        expect(expected.status).toBe("ready");
        if (expected.status !== "ready")
          throw new Error("Fixture scorecard rejected");
        expected.groups
          .flatMap((group) => group.checks)
          .forEach((check, checkIndex) => {
            expect(text(rows[checkIndex]!.label)).toBe(check.label);
            const cell = rows[checkIndex]!.cells[index]!;
            expect(cell).toContain(`data-status="${check.status}"`);
            expect(text(cell)).toContain(check.expression);
            expect(text(cell)).toContain(check.formulaId);
            for (const observation of [
              check.currentObservation,
              check.priorObservation,
            ]) {
              if (observation === null) continue;
              expect(text(cell)).toContain(
                `${observation.value ?? "Unavailable"} ${observation.unit}`,
              );
              expect(text(cell)).toContain(observation.statementDate);
              for (const ref of observation.inputRefs)
                expect(text(cell)).toContain(
                  `${ref.factKey} ← ${ref.sourceRef}`,
                );
            }
          });
      }
      expect(markup.match(/class="manual-peer-quality-inputs"/gu)).toHaveLength(
        12 * count,
      );
      expect(markup).not.toContain("Checks evaluated");
      expect(text(markup)).not.toMatch(/\d+ met ·/u);
    },
  );

  it("keeps negative, zero, missing and nonpositive checks distinct without inventing raw operands", () => {
    const peer = company(
      1,
      {
        net_income: "-10.0000",
        operating_cash_flow: "0.0000",
        current_liabilities: "0.0000",
      },
      { free_cash_flow: unknown() },
    );
    const rows = qualityRows(render([company(0), peer]));
    const cell = (label: string) =>
      rows.find((row) => text(row.label) === label)!.cells[1]!;
    expect(cell("Positive net income")).toContain('data-status="not_met"');
    expect(cell("Positive operating cash flow")).toContain(
      'data-status="not_met"',
    );
    expect(text(cell("Positive free cash flow"))).toContain(
      "Missing input (missing_input)",
    );
    const currentRatio = rows.find(
      (row) =>
        text(row.label).includes("Current ratio") &&
        text(row.cells[1]!).includes("nonpositive_denominator"),
    );
    expect(currentRatio).toBeDefined();
    expect(text(currentRatio!.cells[1]!)).toContain("Unavailable ratio");
    expect(text(currentRatio!.cells[1]!)).toContain(
      "current_liabilities ← 2029:current_liabilities",
    );
    expect(text(currentRatio!.cells[1]!)).not.toContain("0.0000");
  });

  it("shows each company's own statement dates, observations and response timestamp", () => {
    const first = company(0);
    const second = company(1);
    const source = second.annualFinancials!;
    const altered = {
      ...second,
      annualFinancials: {
        ...source,
        asOf: "2030-03-02T12:34:56.000Z",
        years: source.years.map((year) => ({
          ...year,
          statementDate: `${String(year.fiscalYear)}-11-30`,
        })),
      },
    };
    const rows = qualityRows(render([first, altered]));
    const growth = rows.find(
      (row) => text(row.label) === "Positive revenue growth",
    )!;
    expect(text(growth.cells[0]!)).toContain("2029-12-31");
    expect(text(growth.cells[1]!)).toContain("2029-11-30");
    expect(text(growth.cells[1]!)).toContain("2028-11-30");
    expect(text(growth.cells[1]!)).toContain("2030-03-02T12:34:56.000Z");
    expect(text(growth.cells[1]!)).not.toContain("2029-12-31");
    expect(growth.cells[1]!.match(/Source response as of/gu)).toHaveLength(1);
  });

  it("provides unique native summaries, semantic columns and explicit limitations", () => {
    const markup = render([company(0), company(1)]);
    expect(markup).toContain(
      '<table aria-label="Annual quality checks across selected companies"',
    );
    expect(markup).toContain('<th scope="col">Check</th>');
    expect(markup.match(/scope="rowgroup"/gu)).toHaveLength(3);
    expect(markup.match(/scope="row"/gu)).toHaveLength(12);
    const names = [...markup.matchAll(/<summary aria-label="([^"]+)"/gu)].map(
      (match) => match[1],
    );
    expect(new Set(names).size).toBe(24);
    expect(names[0]).toContain("quality check (XNAS · lst-q0)");
    expect(markup).not.toContain(" open=");
    expect(markup).not.toContain("aria-live");
    expect(text(markup)).toContain("not sector-adjusted");
    expect(text(markup)).toContain("not point-in-time filing verification");
    expect(text(markup)).toContain(
      "references identify facts and do not supply every raw operand value",
    );
  });

  it("keeps a missing prior year and a nonconsecutive prior year unavailable without rebasing", () => {
    const primary = company(0);
    const missing = company(1);
    const gap = company(2);
    const one = {
      ...missing,
      annualFinancials: packet(missing.selection, [year(2029)]),
    };
    const two = {
      ...gap,
      annualFinancials: packet(gap.selection, [
        year(2029),
        year(2027),
        year(2026),
      ]),
    };
    const rows = qualityRows(render([primary, one, two]));
    const growth = rows.find(
      (row) => text(row.label) === "Positive revenue growth",
    )!;
    expect(text(growth.cells[1]!)).toContain("insufficient_periods");
    expect(text(growth.cells[2]!)).toContain("non_consecutive_fiscal_years");
    expect(text(rows[0]!.cells[1]!)).toContain("Met");
  });

  it("uses no earlier matching year when the peer latest year differs", () => {
    const peer = company(1);
    const unaligned = {
      ...peer,
      annualFinancials: packet(
        peer.selection,
        [year(2030), year(2029), year(2028)],
        "2031-03-01T15:00:00.000Z",
      ),
    };
    const markup = render([company(0), unaligned]);
    const rows = qualityRows(markup);
    expect(rows).toHaveLength(12);
    expect(
      rows.every((row) => row.cells[1]!.includes('data-status="unavailable"')),
    ).toBe(true);
    expect(text(markup)).toContain(
      "Latest annual fiscal year differs from the selected company's year",
    );
    expect(markup.match(/class="manual-peer-quality-inputs"/gu)).toHaveLength(
      12,
    );
  });

  it("does not map a quarantined full packet including a malformed hidden period", () => {
    const peer = company(1);
    const invalid = {
      ...peer,
      annualFinancials: packet(peer.selection, [
        year(2029),
        year(2028),
        year(2027, { revenue: "INVALID_HIDDEN_VALUE" }),
      ]),
    };
    const props = propsFor([company(0), invalid]);
    expect(props.admission.companies[1]!.annual.status).toBe("quarantined");
    const markup = renderToStaticMarkup(
      <PersonalManualPeerQualityComparison {...props} />,
    );
    expect(text(markup)).toContain("Annual source quarantined");
    expect(markup).not.toContain("INVALID_HIDDEN_VALUE");
    expect(markup.match(/class="manual-peer-quality-inputs"/gu)).toHaveLength(
      12,
    );
  });

  it("requires a primary annual anchor and never emits a table for zero peers", () => {
    const primary = { ...company(0), annualFinancials: null };
    const markup = render([primary, company(1)]);
    expect(text(markup)).toContain(
      "Load valid annual statements for the selected company",
    );
    expect(markup).not.toContain("<table");
    expect(render([company(0)])).toBe("");
  });

  it.each([
    "country",
    "exchangeMic",
    "issuerId",
    "issuerName",
    "listingId",
    "securityName",
    "symbol",
  ] as const)(
    "withholds a stale ordered carrier when its %s changes",
    (field) => {
      const props = propsFor([company(0), company(1)]);
      const second = props.companies[1]!;
      const replacement = {
        ...second,
        selection: { ...second.selection, [field]: "replaced" },
      } as PersonalManualPeerQualityCompanyInput;
      expect(
        renderToStaticMarkup(
          <PersonalManualPeerQualityComparison
            {...props}
            companies={[props.companies[0]!, replacement]}
          />,
        ),
      ).toBe("");
    },
  );

  it("refuses a reordered source association even with the same admitted listing set", () => {
    const props = propsFor([company(0), company(1), company(2)]);
    expect(
      renderToStaticMarkup(
        <PersonalManualPeerQualityComparison
          {...props}
          companies={[
            props.companies[0]!,
            props.companies[2]!,
            props.companies[1]!,
          ]}
        />,
      ),
    ).toBe("");
  });

  it("uses content keys for equal mounted results and changes keys with rendered source or identity", () => {
    const props = propsFor([company(0), company(1)]);
    const initial = disclosureKeys(props);
    expect(disclosureKeys(structuredClone(props))).toEqual(initial);
    const peer = company(1, { net_income: "-77.2500" });
    expect(disclosureKeys(propsFor([company(0), peer]))).not.toEqual(initial);
    const renamed = {
      ...peer,
      selection: { ...peer.selection, issuerName: "Changed & exact issuer" },
    };
    const matching = {
      ...renamed,
      annualFinancials: packet(renamed.selection, peer.annualFinancials!.years),
    };
    expect(disclosureKeys(propsFor([company(0), matching]))).not.toEqual(
      disclosureKeys(propsFor([company(0), peer])),
    );
    const timestamp = {
      ...company(1),
      annualFinancials: {
        ...company(1).annualFinancials!,
        asOf: "2030-03-02T15:00:00.000Z",
      },
    };
    expect(disclosureKeys(propsFor([company(0), timestamp]))).not.toEqual(
      initial,
    );
    // Native open/close and mounted reconciliation require the separate Brave fixture.
  });

  it("escapes exact long identity strings while preserving disclosure wrapping hooks", () => {
    const peer = company(1);
    const identity = {
      ...peer.selection,
      issuerName: `${"長".repeat(220)}<script>&`,
      securityName: "S".repeat(250),
    };
    const markup = render([
      company(0),
      {
        selection: identity,
        annualFinancials: packet(identity, peer.annualFinancials!.years),
      },
    ]);
    expect(markup).toContain("&lt;script&gt;&amp;");
    expect(markup).not.toContain("<script>");
    expect(markup).toContain("S".repeat(250));
    expect(markup).toContain('class="manual-peer-quality-inputs"');
    expect(markup).toContain('class="manual-peer-metric-inputs-body"');
  });
});

function propsFor(
  companies: readonly PersonalManualPeerQualityCompanyInput[],
): PersonalManualPeerQualityComparisonProps {
  const inputs = companies.map((carrier) => ({
    ...carrier,
    valuationHistory: null,
  }));
  return {
    companies,
    admission: buildPersonalManualPeerComparison({
      primary: inputs[0]!,
      peers: inputs.slice(1),
    }),
  };
}

function render(
  companies: readonly PersonalManualPeerQualityCompanyInput[],
): string {
  return renderToStaticMarkup(
    <PersonalManualPeerQualityComparison {...propsFor(companies)} />,
  );
}

function qualityRows(markup: string) {
  return [
    ...markup.matchAll(
      /<tr><th scope="row">([\s\S]*?)<\/th>([\s\S]*?)<\/tr>/gu,
    ),
  ].map((match) => ({
    label: match[1]!,
    cells: [...match[2]!.matchAll(/<td\b[\s\S]*?<\/td>/gu)].map(
      (cell) => cell[0],
    ),
  }));
}

function disclosureKeys(
  props: PersonalManualPeerQualityComparisonProps,
): string[] {
  const keys: string[] = [];
  function visit(node: ReactNode): void {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!isValidElement(node)) return;
    const element = node as ReactElement<{ readonly children?: ReactNode }>;
    if (typeof element.type === "function") {
      if (element.type.name === "QualityDisclosure")
        keys.push(String(element.key));
      visit((element.type as (props: object) => ReactNode)(element.props));
    } else visit(element.props.children);
  }
  visit(PersonalManualPeerQualityComparison(props));
  return keys;
}

type Values = Partial<
  Record<PersonalAnnualFinancialReportedFieldKeyDto, string>
>;
type Cells = Partial<PersonalAnnualFinancialReportedValuesDto>;
function company(
  index: number,
  values: Values = {},
  cells: Cells = {},
): PersonalManualPeerQualityCompanyInput {
  const selection = {
    country: "US" as const,
    exchangeMic: "XNAS",
    issuerId: `issuer-q${String(index)}`,
    issuerName: `Quality ${String(index)} Inc.`,
    listingId: `lst-q${String(index)}`,
    securityName: `Quality ${String(index)} Common`,
    symbol: `Q${String(index)}`,
  };
  return {
    selection,
    annualFinancials: packet(selection, [
      year(2029, values, cells),
      year(2028),
    ]),
  };
}

function year(
  fiscalYear: number,
  values: Values = {},
  cells: Cells = {},
): PersonalAnnualFinancialsDto["years"][number] {
  const strong: Values =
    fiscalYear === 2029
      ? {
          assets: "2000",
          current_assets: "800",
          current_liabilities: "400",
          debt: "300",
          free_cash_flow: "180",
          gross_profit: "500",
          net_income: "150",
          operating_cash_flow: "240",
          operating_income: "220",
          revenue: "1200",
          shareholders_equity: "1200",
        }
      : {
          assets: "1800",
          current_assets: "700",
          current_liabilities: "350",
          debt: "350",
          free_cash_flow: "140",
          gross_profit: "400",
          net_income: "120",
          operating_cash_flow: "200",
          operating_income: "180",
          revenue: "1000",
          shareholders_equity: "1050",
        };
  return {
    fiscalYear,
    statementDate: `${String(fiscalYear)}-12-31`,
    reported: Object.fromEntries(
      PERSONAL_FINANCIAL_REPORTED_FIELDS.map(({ fieldKey }) => [
        fieldKey,
        cells[fieldKey] ?? {
          status: "known",
          value: values[fieldKey] ?? strong[fieldKey] ?? "1",
        },
      ]),
    ) as PersonalAnnualFinancialReportedValuesDto,
  };
}

function packet(
  selection: PersonalManualPeerQualityCompanyInput["selection"],
  years: PersonalAnnualFinancialsDto["years"],
  asOf = "2030-03-01T15:00:00.000Z",
): PersonalAnnualFinancialsDto {
  const latestFiscalYear = years[0]!.fiscalYear;
  const earliestFiscalYear = years.at(-1)!.fiscalYear;
  const cells = years.flatMap((annual) => Object.values(annual.reported));
  const unknownReportedCells = cells.filter(
    (cell) => cell.status === "unknown",
  ).length;
  const present = new Set(years.map((annual) => annual.fiscalYear));
  const missingFiscalYears = Array.from(
    { length: 10 },
    (_, index) => latestFiscalYear - index,
  ).filter((fiscalYear) => !present.has(fiscalYear));
  return {
    asOf,
    coverage: {
      earliestFiscalYear,
      latestFiscalYear,
      knownReportedCells: cells.length - unknownReportedCells,
      unknownReportedCells,
      missingFiscalYears,
      requestedAnnualYears: 10,
      returnedAnnualYears: years.length,
      status:
        unknownReportedCells === 0 && missingFiscalYears.length === 0
          ? "complete"
          : "partial",
    },
    profile: "personal_single_user_local_fundamentals",
    schemaVersion: "1.1.0",
    status: "available",
    provider: {
      attribution: "Tiingo",
      export: "prohibited",
      id: "tiingo",
      name: "Tiingo",
      persistence: "none",
      redistribution: "prohibited",
      retention: "active_owner_session_memory_only",
      revisionBasis: "provider_most_recent",
      statementFeed: "tiingo_fundamentals_statements",
      valueCurrency: "USD",
    },
    security: {
      country: selection.country,
      exchangeMic: selection.exchangeMic,
      issuerName: selection.issuerName,
      listingId: selection.listingId,
      securityName: selection.securityName,
      symbol: selection.symbol,
    },
    years,
  };
}

function unknown() {
  return {
    status: "unknown" as const,
    value: null,
    reason: "not_supplied_by_provider" as const,
  };
}
function text(markup: string): string {
  return markup
    .replace(/<[^>]*>/gu, " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&#x27;", "'")
    .replaceAll("&quot;", '"')
    .replace(/\s+/gu, " ")
    .trim();
}
