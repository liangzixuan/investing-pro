import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY,
  type PersonalSecAnnualCanonicalEvidenceDto,
  type PersonalSecAnnualStatementConcept,
  type PersonalSecAnnualStatementDto,
  type PersonalSecAnnualStatementObservationDto,
  type PersonalSecAnnualStatementsDto,
} from "@research-cockpit/contracts";
import {
  AnnualStatementCell,
  AnnualStatementTable,
  ManagedAnnualStatements,
  type ManagedAnnualStatementsProps,
} from "./ManagedAnnualStatements";

const hooks = vi.hoisted((): { direct: boolean; selected: unknown } => ({
  direct: false,
  selected: undefined,
}));
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  return {
    ...actual,
    useId: () => (hooks.direct ? "statement-test" : actual.useId()),
    useState: (initial: unknown) => {
      if (!hooks.direct) return actual.useState(initial);
      if (hooks.selected === undefined) hooks.selected = initial;
      return [
        hooks.selected,
        (value: unknown) => {
          hooks.selected = value;
        },
      ];
    },
  };
});
beforeEach(() => {
  hooks.direct = false;
  hooks.selected = undefined;
});

const current = "2025-12-31";
const prior = "2024-12-31";
const huge = "9007199254740993123456789.012345678901234567";
const specs: readonly (readonly [
  PersonalSecAnnualStatementConcept,
  string,
  string,
  string | null,
])[] = [
  ["Revenues", huge, current, "2025-01-01"],
  ["Revenues", "0", prior, "2024-01-01"],
  ["NetIncomeLoss", "-55.000000000000000001", current, "2025-01-02"],
  ["Assets", "50.125", current, null],
  ["StockholdersEquity", "-7.5", current, null],
  [
    "NetCashProvidedByUsedInOperatingActivities",
    "120.125",
    current,
    "2025-01-01",
  ],
  [
    "NetCashProvidedByUsedInInvestingActivities",
    "-12.25",
    current,
    "2025-01-01",
  ],
  ["GrossProfit", "11", current, "2025-01-01"],
  ["GrossProfit", "12", current, "2025-01-01"],
];
function fixture(): {
  evidence: PersonalSecAnnualCanonicalEvidenceDto;
  statements: PersonalSecAnnualStatementsDto;
} {
  const observations: PersonalSecAnnualStatementObservationDto[] = specs.map(
    ([concept, value, endDate, startDate], i) => ({
      id: `sec-fact:${i.toString(16).padStart(64, "0")}`,
      concept,
      taxonomy: "us-gaap",
      unit: "USD",
      value,
      startDate,
      endDate,
      durationDays:
        startDate === null
          ? null
          : (Date.parse(endDate) - Date.parse(startDate)) / 86_400_000 + 1,
      periodBasis: "unresolved",
      filingFocusYear: 2025,
      filingFocusPeriod: "FY",
      frame: null,
      accessionNumber: "0000000001-26-000001",
      form: "10-K",
      filedDate: "2026-02-20",
      sourceLocator: `/facts/us-gaap/${concept}/units/USD/${i}`,
      filing: {
        status: "matched",
        form: "10-K",
        filedDate: "2026-02-20",
        reportDate: current,
        acceptedAt: "2026-02-20T16:00:00.000Z",
        sourceUrl:
          "https://www.sec.gov/Archives/edgar/data/1/000000000126000001/0000000001-26-000001-index.html",
      },
    }),
  );
  const statements: PersonalSecAnnualStatementsDto = {
    contextReason: null,
    utilityAge: { endAgeDays: 60, sourceAgeDays: [0, 0], withinWindow: true },
    statements: (
      ["income_statement", "balance_sheet", "cash_flow"] as const
    ).map((id) => {
      const columns = (
        id === "balance_sheet"
          ? [current, prior]
          : [current, prior, "2023-12-31"]
      ).map((endDate) => ({
        endDate,
        kind:
          endDate === current
            ? ("selected_report" as const)
            : ("comparative" as const),
      }));
      return {
        id,
        columns,
        rows: PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY.filter(
          (entry) => entry.statement === id,
        ).map((entry) => ({
          concept: entry.concept,
          lineId: entry.lineId,
          cells: columns.map((column) => {
            const matches = observations.filter(
              (o) =>
                o.concept === entry.concept && o.endDate === column.endDate,
            );
            const observationIds = matches.map((o) => o.id);
            if (matches.length > 1)
              return {
                endDate: column.endDate,
                observationIds,
                status: "unavailable" as const,
                reason: "ambiguous_value" as const,
              };
            const match = matches[0];
            return match
              ? {
                  endDate: column.endDate,
                  observationIds,
                  status: "available" as const,
                  value: match.value,
                  startDate: match.startDate,
                  currentUseEligible: column.kind === "selected_report",
                }
              : {
                  endDate: column.endDate,
                  observationIds,
                  status: "unavailable" as const,
                  reason: "concept_missing" as const,
                };
          }),
        })),
      };
    }),
  };
  const source = (sourceUrl: string) => ({
    status: "available" as const,
    sourceUrl,
    fetchedAt: "2026-03-01T00:00:00.000Z",
    sha256: `sha256:${"a".repeat(64)}` as const,
    bytes: 1000,
  });
  const evidence: PersonalSecAnnualCanonicalEvidenceDto = {
    cik: "0000000001",
    generation: {
      definitionVersion: "6.0.0",
      cutoffAt: "2026-03-01T00:00:00.000Z",
      completedAt: "2026-03-01T00:00:01.000Z",
      sources: {
        companyFacts: source(
          "https://data.sec.gov/api/xbrl/companyfacts/CIK0000000001.json",
        ),
        submissions: source(
          "https://data.sec.gov/submissions/CIK0000000001.json",
        ),
      },
      sha256: `sha256:${"b".repeat(64)}`,
    },
    target: {
      status: "target",
      accessionNumber: "0000000001-26-000001",
      form: "10-K",
      reportDate: current,
      filedDate: "2026-02-20",
      acceptedAt: "2026-02-20T16:00:00.000Z",
    },
    targetScan: {
      currentFilings: 1,
      annualFilings: 1,
      olderHistoryAvailable: true,
    },
    facts: {
      registryVersion: "1.0.0",
      observations,
      scans: PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY.map((entry) => {
        const count = observations.filter(
          (o) => o.concept === entry.concept,
        ).length;
        return {
          concept: entry.concept,
          scan: {
            status: "available",
            absence: count ? null : "concept_missing",
            coverage: {
              full: {
                candidateRows: count,
                inspectedRows: count,
                invalidRows: 0,
                duplicateRows: 0,
                uniqueObservations: count,
              },
              selected: count,
              otherAccessions: 0,
              returned: count,
              omittedSelected: 0,
            },
          },
        };
      }),
    },
  };
  return { evidence, statements };
}
function props(): ManagedAnnualStatementsProps {
  return {
    ...fixture(),
    selectedCells: [{ concept: "Revenues", endDate: prior }],
    onToggleCell: vi.fn(),
  };
}
function elements(
  node: React.ReactNode,
): React.ReactElement<Record<string, unknown>>[] {
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  return [
    node,
    ...React.Children.toArray(node.props.children as React.ReactNode).flatMap(
      elements,
    ),
  ];
}
function direct(input: ManagedAnnualStatementsProps) {
  hooks.direct = true;
  const node = ManagedAnnualStatements(input);
  hooks.direct = false;
  return node;
}
function statement(
  input: ManagedAnnualStatementsProps,
  id: PersonalSecAnnualStatementDto["id"],
) {
  return input.statements.statements.find((s) => s.id === id)!;
}

describe("standardized annual statement reader", () => {
  it("shows exact signed full-USD values, independent refusals and actual start/end dates", () => {
    const input = props();
    const html = renderToStaticMarkup(<ManagedAnnualStatements {...input} />);
    expect(html).toContain(`USD ${huge}`);
    expect(html).toContain("USD -55.000000000000000001");
    expect(html).toContain("USD 0");
    expect(html).toContain("2025-01-02 through 2025-12-31");
    expect(html).toContain("2024-01-01 through 2024-12-31");
    expect(html).toContain("Historical comparative");
    expect(html).toContain(
      "Historical value; not eligible for current use at this load.",
    );
    expect(html).toContain("Reported observations disagree on the amount.");
    expect(html).toContain("This exact concept is absent from Company Facts.");
    expect(html).toContain("Net sales revenue (legacy basis)");
    expect(html).toContain(
      "Deprecated in 2018; absent from the 2026 taxonomy.",
    );
    expect(html).not.toContain("<details open");
    expect(html.match(/type="checkbox"/gu)).toHaveLength(3);
    expect(html.match(/checked=""/gu)).toHaveLength(1);
    expect(input.onToggleCell).not.toHaveBeenCalled();
  });
  it("covers every registered concept across the three views with meaningful labels and semantic headers", () => {
    const input = props();
    const parts = input.statements.statements.map((s) =>
      renderToStaticMarkup(<AnnualStatementTable {...input} statement={s} />),
    );
    expect(
      parts.reduce(
        (total, html) => total + (html.match(/<th scope="row"/gu)?.length ?? 0),
        0,
      ),
    ).toBe(32);
    for (const entry of PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY)
      expect(parts.join("")).toContain(entry.label.replace(/'/gu, "&#x27;"));
    expect(parts[1]).toContain("USD -7.5");
    expect(parts[1]).toContain("At 2025-12-31");
    expect(parts[1]).not.toContain('<th scope="col">2023-12-31');
    expect(parts[2]).toContain("USD -12.25");
    expect(parts[2]).toContain(
      "not comprehensive capital expenditure".replace("not", "Not"),
    );
    for (const html of parts) {
      expect(html).toContain("<caption>");
      expect(html).toContain('role="region"');
      expect(html).toContain('tabindex="0"');
      expect(html).toContain('scope="col"');
    }
  });
  it("changes only the reader's selected statement and ignores unlisted choices", () => {
    const input = props();
    const node = direct(input);
    const select = elements(node).find((e) => e.type === "select")!;
    (
      select.props.onChange as (e: { currentTarget: { value: string } }) => void
    )({ currentTarget: { value: "balance_sheet" } });
    const changed = direct(input);
    const table = elements(changed).find(
      (e) => e.type === AnnualStatementTable,
    )!;
    expect((table.props.statement as PersonalSecAnnualStatementDto).id).toBe(
      "balance_sheet",
    );
    const currentSelect = elements(changed).find((e) => e.type === "select")!;
    (
      currentSelect.props.onChange as (e: {
        currentTarget: { value: string };
      }) => void
    )({ currentTarget: { value: "unknown" } });
    expect(
      (
        elements(direct(input)).find((e) => e.type === AnnualStatementTable)!
          .props.statement as PersonalSecAnnualStatementDto
      ).id,
    ).toBe("balance_sheet");
    expect(input.onToggleCell).not.toHaveBeenCalled();
  });
  it("selects available comparative cells with exact concept/date callbacks and gives refusals no checkbox", () => {
    const input = props();
    const tree = AnnualStatementTable({
      ...input,
      statement: statement(input, "income_statement"),
    });
    const cellNodes = elements(tree).filter(
      (e) => e.type === AnnualStatementCell,
    );
    const comparative = cellNodes.find(
      (e) =>
        (e.props.entry as { concept: string }).concept === "Revenues" &&
        (e.props.cell as { endDate: string }).endDate === prior,
    )!;
    const node = AnnualStatementCell(
      comparative.props as unknown as Parameters<typeof AnnualStatementCell>[0],
    );
    const checkbox = elements(node).find((e) => e.type === "input")!;
    expect(checkbox.props.checked).toBe(true);
    expect(checkbox.props["aria-label"]).toContain(
      "2024-01-01 through 2024-12-31, USD 0",
    );
    (checkbox.props.onChange as () => void)();
    expect(input.onToggleCell).toHaveBeenCalledExactlyOnceWith(
      "Revenues",
      prior,
    );
    const refused = cellNodes.find(
      (e) =>
        (e.props.entry as { concept: string }).concept === "GrossProfit" &&
        (e.props.cell as { endDate: string }).endDate === current,
    )!;
    const html = renderToStaticMarkup(
      <AnnualStatementCell
        {...(refused.props as unknown as Parameters<
          typeof AnnualStatementCell
        >[0])}
      />,
    );
    expect(html).toContain("Unavailable.");
    expect(html).not.toContain("<input");
  });
  it("keeps local reading available while disabled blocks note-cell callbacks", () => {
    const input = { ...props(), disabled: true };
    const select = elements(direct(input)).find((e) => e.type === "select")!;
    expect(select.props.disabled).not.toBe(true);
    (
      select.props.onChange as (e: { currentTarget: { value: string } }) => void
    )({ currentTarget: { value: "cash_flow" } });
    expect(hooks.selected).toBe("cash_flow");
    const changedTable = elements(direct(input)).find(
      (e) => e.type === AnnualStatementTable,
    )!;
    expect(
      (changedTable.props.statement as PersonalSecAnnualStatementDto).id,
    ).toBe("cash_flow");
    const entry = PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY.find(
      (e) => e.concept === "Revenues",
    )!;
    const cell = statement(input, "income_statement").rows.find(
      (r) => r.concept === "Revenues",
    )!.cells[0]!;
    const node = AnnualStatementCell({
      entry,
      cell,
      selected: false,
      disabled: true,
      onToggleCell: input.onToggleCell,
    });
    const checkbox = elements(node).find((e) => e.type === "input")!;
    expect(checkbox.props.disabled).toBe(true);
    (checkbox.props.onChange as () => void)();
    expect(input.onToggleCell).not.toHaveBeenCalled();
    expect(
      renderToStaticMarkup(<ManagedAnnualStatements {...input} />),
    ).toContain("Inspect filing and original source references");
  });
  it("retains exact concepts, amounts, references, pointers and original source clocks inside closed inspection", () => {
    const input = props();
    const html = renderToStaticMarkup(<ManagedAnnualStatements {...input} />);
    expect(html).toContain("us-gaap:Revenues · USD");
    expect(html).toContain("/facts/us-gaap/Revenues/units/USD/0");
    expect(html).toContain(input.evidence.facts.observations[0]!.id);
    expect(html).toContain("USD 11");
    expect(html).toContain("USD 12");
    expect(html).toContain("2026-02-20T16:00:00.000Z");
    expect(html).toContain("Company Facts captured 2026-03-01T00:00:00.000Z");
    expect(html).toContain("Original load completed 2026-03-01T00:00:01.000Z");
    expect(html).toContain("Cell references for 2025-12-31");
    expect(html).not.toContain("<pre");
    expect(html).not.toContain("<button");
  });
  it("explains unresolved target context without inventing a report date or table columns", () => {
    const input = props();
    const html = renderToStaticMarkup(
      <ManagedAnnualStatements
        {...input}
        evidence={{
          ...input.evidence,
          target: { status: "unresolved", reason: "no_observed_annual_target" },
        }}
        statements={{
          ...input.statements,
          contextReason: "target_unresolved",
          statements: input.statements.statements.map((s) => ({
            ...s,
            columns: [],
            rows: s.rows.map((r) => ({ ...r, cells: [] })),
          })),
        }}
      />,
    );
    expect(html).toContain(
      "An annual filing could not be selected for this load.",
    );
    expect(html).toContain(
      "Statement availability: An annual filing could not be selected.",
    );
    expect(html).toContain(
      "No admitted statement dates are available for this load.",
    );
    expect(html).not.toContain("<table");
    expect(html).not.toContain("<input");
  });
});
