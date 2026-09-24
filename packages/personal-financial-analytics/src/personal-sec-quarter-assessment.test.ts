import { describe, expect, it } from "vitest";
import {
  isPersonalSecQuarterAssessmentInput,
  isPersonalSecQuarterAnalysis,
  isPersonalSecQuarterPrimaryEvidence,
  isPersonalSecQuarterEvidence,
  PERSONAL_SEC_QUARTERLY_CONCEPTS,
  type PersonalSecQuarterAssessmentInputDto,
  type PersonalSecQuarterPrimaryEvidenceDto,
  type QuarterPrimaryOccurrence,
  type QuarterSourceRecord,
  type QuarterXmlObservation,
} from "@research-cockpit/contracts";
import { assessPersonalSecQuarterEvidence } from "./personal-sec-quarter-assessment";

type Mutable<T> = T extends object
  ? { -readonly [K in keyof T]: Mutable<T[K]> }
  : T;
type Input = Mutable<PersonalSecQuarterAssessmentInputDto>;
type RecordNode = Mutable<QuarterSourceRecord>;
type XmlNode = Mutable<QuarterXmlObservation>;
const HTML = "http://www.w3.org/1999/xhtml";
const IX = "http://www.xbrl.org/2013/inlineXBRL";
const XBRLI = "http://www.xbrl.org/2003/instance";
const GAAP = "http://fasb.org/us-gaap/2025";
const DEI = "http://xbrl.sec.gov/dei/2025";
const CIK = "0000999999";
const accession = "0000999999-25-000001";
const sha = (digit: string): `sha256:${string}` => `sha256:${digit.repeat(64)}`;
const qname = (localName: string, namespace = HTML, prefix = "") => ({
  raw: prefix ? `${prefix}:${localName}` : localName,
  namespace,
  localName,
});
const attribute = (name: string, value: string) => ({
  name,
  namespace: null,
  localName: name,
  value,
});
interface Tree {
  key: string;
  tag: string;
  text?: string;
  tail?: string;
  children?: Tree[];
  span?: number;
  fact?: "Revenues" | "NetIncomeLoss";
  cash?: "opening" | "closing";
}
function tree(
  key: string,
  tag: string,
  text = "",
  children: Tree[] = [],
): Tree {
  return { key, tag, text, children };
}

/** Synthetic raw-observation graph; no retained filing or reviewed authority. */
function fixture(
  options: {
    end?: string;
    fiscalEnd?: string;
    slot?: 1 | 2 | 3;
    start?: string;
    revenue?: string;
    income?: string;
    displayRevenue?: string;
    displayIncome?: string;
    units?: string;
    separateCover?: boolean;
    calendarMethod?: "cash";
    splitCash?: "table" | "column";
  } = {},
) {
  const end = options.end ?? "2025-03-31",
    start = options.start ?? "2025-01-01",
    fiscalEnd = options.fiscalEnd ?? "2025-12-31",
    slot = options.slot ?? 1;
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const english = (date: string) =>
    `${months[Number(date.slice(5, 7)) - 1]} ${Number(date.slice(8, 10))}, ${date.slice(0, 4)}`;
  const dateText = english(end),
    year = Number(fiscalEnd.slice(0, 4));
  const revenue = options.revenue ?? "100000000",
    income = options.income ?? "-20000000";
  const financialRow = (
    kind: "rev" | "ni",
    label: string,
    text: string,
  ): Tree => {
    const parentheses = text.startsWith("(") && text.endsWith(")");
    const minus = text.startsWith("-");
    const raw = parentheses ? text.slice(1, -1) : minus ? text.slice(1) : text;
    return tree(kind, "tr", "", [
      tree(`${kind}-label`, "td", label),
      tree(`${kind}-currency`, "td", "$"),
      {
        ...tree(`${kind}-number`, "td", parentheses ? "(" : minus ? "-" : "", [
          {
            ...tree(`${kind}-fact`, "nonFraction", raw),
            fact: kind === "rev" ? "Revenues" : "NetIncomeLoss",
          },
        ]),
        tail: parentheses ? ")" : "",
      },
      tree(`${kind}-close`, "td", ""),
    ]);
  };
  const root = tree("html", "html", "", [
    tree("body", "body", "", [
      tree("cover", "div", "", [
        tree(
          "quarterly",
          "p",
          "☒ Quarterly report pursuant to Section 13 or 15(d)",
        ),
        ...(options.separateCover
          ? [
              tree("transition-wrapper", "div", "", [
                tree(
                  "transition",
                  "p",
                  "☐ Transition report pursuant to Section 13 or 15(d)",
                ),
              ]),
            ]
          : [
              tree(
                "transition",
                "p",
                "☐ Transition report pursuant to Section 13 or 15(d)",
              ),
            ]),
        tree("cover-end", "p", `For the quarterly period ended ${dateText}`),
      ]),
      tree("section", "p", "Item 1. Financial Statements"),
      tree("balance-heading", "p", "Condensed Consolidated Balance Sheets"),
      tree("balance", "table", "", [
        tree("balance-row", "tr", "", [tree("balance-cell", "td", dateText)]),
      ]),
      tree(
        "income-heading",
        "p",
        "Condensed Consolidated Statements of Income",
      ),
      tree("income-units", "p", options.units ?? "(in millions)"),
      tree("income", "table", "", [
        tree("duration-row", "tr", "", [
          tree("duration-blank", "td", ""),
          { ...tree("duration", "th", "Three months ended"), span: 3 },
        ]),
        tree("year-row", "tr", "", [
          tree("year-blank", "td", ""),
          tree("year-currency", "th", ""),
          tree("year", "th", dateText),
          tree("year-close", "th", ""),
        ]),
        financialRow("rev", "Total revenues", options.displayRevenue ?? "100"),
        financialRow(
          "ni",
          "Net loss attributable to the parent",
          options.displayIncome ?? "(20)",
        ),
      ]),
      tree(
        "cash-heading",
        "p",
        "Condensed Consolidated Statements of Cash Flows",
      ),
      tree(
        "cash",
        "table",
        "",
        options.calendarMethod === "cash"
          ? [
              tree("cash-duration-row", "tr", "", [
                tree("cash-duration-blank", "td"),
                tree(
                  "cash-duration",
                  "th",
                  `${["", "Three", "Six", "Nine"][slot]} months ended`,
                ),
              ]),
              tree("cash-year-row", "tr", "", [
                tree("cash-year-blank", "td"),
                tree("cash-year", "th", dateText),
              ]),
              ...(["opening", "closing"] as const).map((kind) =>
                tree(`cash-${kind}-row`, "tr", "", [
                  tree(
                    `cash-${kind}-label`,
                    "td",
                    `Cash and cash equivalents at ${kind === "opening" ? "beginning of year" : "end of period"}`,
                  ),
                  tree(`cash-${kind}-cell`, "td", "", [
                    { ...tree(`cash-${kind}`, "nonFraction", "1"), cash: kind },
                  ]),
                ]),
              ),
            ]
          : [tree("cash-row", "tr", "", [tree("cash-cell", "td", dateText)])],
      ),
      tree(
        "notes",
        "p",
        "Notes to Condensed Consolidated Financial Statements",
      ),
      tree(
        "calendar",
        "p",
        options.calendarMethod === "cash"
          ? `These consolidated financial statements are for the current fiscal year ending ${english(fiscalEnd)}.`
          : `Our fiscal year ending ${english(fiscalEnd)} consists of twelve calendar months.`,
      ),
      ...(options.calendarMethod === "cash"
        ? [
            tree(
              "interim-basis",
              "p",
              "These unaudited condensed consolidated financial statements have been prepared for interim financial reporting in accordance with generally accepted accounting principles and the rules and regulations of the Securities and Exchange Commission.",
            ),
          ]
        : []),
      tree(
        "slot",
        "p",
        `These financial statements cover the ${["", "first", "second", "third"][slot]} quarter of fiscal year ${year}.`,
      ),
      tree(
        "consolidation",
        "p",
        "The accompanying consolidated financial statements include the accounts of Example Corporation and its wholly-owned subsidiaries. All intercompany transactions are eliminated.",
      ),
      tree("registrant", "nonNumeric", "Example Corporation"),
    ]),
  ]);
  if (options.splitCash) {
    const body = root.children![0]!;
    const cash = body.children!.find((node) => node.key === "cash")!;
    const closing = cash.children!.at(-1)!;
    if (options.splitCash === "column") {
      closing.children!.splice(1, 0, tree("cash-closing-spacer", "td"));
      cash.children![0]!.children![1]!.span = 2;
      cash.children![1]!.children![1]!.span = 2;
    } else {
      cash.children!.pop();
      const headers = structuredClone(cash.children!.slice(0, 2));
      const rename = (node: Tree): void => {
        node.key += "-other";
        node.children?.forEach(rename);
      };
      headers.forEach(rename);
      body.children!.splice(
        body.children!.indexOf(cash) + 1,
        0,
        tree(
          "cash-other-heading",
          "p",
          "Condensed Consolidated Statements of Cash Flows",
        ),
        tree("cash-other", "table", "", [...headers, closing]),
      );
    }
  }
  let ordinal = 0,
    tableOrdinal = 0;
  const records: RecordNode[] = [],
    named = new Map<string, RecordNode>();
  const tables: Mutable<
    NonNullable<PersonalSecQuarterPrimaryEvidenceDto["structure"]>["tables"]
  > = [];
  const facts: Mutable<QuarterPrimaryOccurrence>[] = [];
  const cashNodes: { node: RecordNode; kind: "opening" | "closing" }[] = [];
  function walk(
    t: Tree,
    parent: RecordNode | null,
    childIndex: number,
    scope: [number | null, number | null, number | null],
  ): RecordNode {
    const own = ++ordinal;
    if (t.tag === "table") scope = [++tableOrdinal, null, null];
    if (t.tag === "tr") scope = [scope[0], childIndex + 1, null];
    if (t.tag === "td" || t.tag === "th")
      scope = [scope[0], scope[1], childIndex + 1];
    const inline = t.tag === "nonFraction" || t.tag === "nonNumeric";
    const r: RecordNode = {
      id: `e:${own}`,
      elementOrdinal: own,
      endElementOrdinal: own,
      name: qname(t.tag, inline ? IX : HTML, inline ? "ix" : ""),
      attributes: t.span ? [attribute("colspan", String(t.span))] : [],
      parentRecordId: parent?.id ?? null,
      parentElementOrdinal: parent?.elementOrdinal ?? null,
      childIndex,
      elementChildCount: t.children?.length ?? 0,
      descendantTableCount: 0,
      descendantTableOrdinals: [],
      textRuns: [{ beforeChildIndex: 0, text: t.text ?? "" }],
      childRecordIds: [],
      childrenComplete: true,
      actualTableOrdinal: scope[0],
      actualRowOrdinal: scope[1],
      actualCellOrdinal: scope[2],
    };
    records.push(r);
    named.set(t.key, r);
    const children = (t.children ?? []).map((child, i) =>
      walk(child, r, i, scope),
    );
    if (t.tail)
      r.textRuns!.push({ beforeChildIndex: children.length, text: t.tail });
    r.childRecordIds = children.map((c) => c.id);
    r.endElementOrdinal = ordinal;
    r.descendantTableOrdinals = children.flatMap((child) => [
      ...(child.name.localName === "table" ? [child.actualTableOrdinal!] : []),
      ...child.descendantTableOrdinals!,
    ]);
    r.descendantTableCount = r.descendantTableOrdinals.length;
    if (t.tag === "table") {
      tables.push({
        tableRecordId: r.id,
        status: "complete",
        reasons: [],
        rowRecordIds: children.map((c) => c.id),
        rows: children.map((child) => {
          let column = 0;
          return {
            rowRecordId: child.id,
            cells: child.childRecordIds.map((id) => {
              const cell = records.find((x) => x.id === id)!;
              const span = Number(
                cell.attributes.find((a) => a.name === "colspan")?.value ?? "1",
              );
              const out = {
                cellRecordId: id,
                columnStart: column,
                columnSpan: span,
                rowSpan: 1,
              };
              column += span;
              return out;
            }),
          };
        }),
      });
    }
    if (t.fact) {
      const scale =
        options.units === "(dollars)"
          ? "0"
          : options.units === "(in thousands)"
            ? "3"
            : "6";
      const sign = (t.fact === "Revenues" ? revenue : income).startsWith("-")
        ? "-"
        : null;
      r.attributes = [
        attribute("name", `us-gaap:${t.fact}`),
        attribute("contextRef", "current"),
        attribute("unitRef", "usd"),
        attribute("scale", scale),
        attribute("decimals", `-${scale}`),
        ...(sign ? [attribute("sign", sign)] : []),
      ];
      facts.push({
        id: `f:${own}`,
        elementOrdinal: own,
        locator: `/elements/${own}`,
        factId: null,
        concept: qname(t.fact, GAAP, "us-gaap"),
        rawContextRef: "current",
        contextRecordId: null,
        rawUnitRef: "usd",
        unitRecordId: null,
        rawText: t.text ?? "",
        format: null,
        sign,
        scale,
        decimals: `-${scale}`,
        precision: null,
        value: t.fact === "Revenues" ? revenue : income,
        issues: [],
        elementRecordId: r.id,
        actualTableOrdinal: scope[0],
        actualRowOrdinal: scope[1],
        actualCellOrdinal: scope[2],
      });
    }
    if (t.cash) cashNodes.push({ node: r, kind: t.cash });
    return r;
  }
  walk(root, null, 0, [null, null, null]);
  function xml(
    local: string,
    text = "",
    attributes: XmlNode["attributes"] = [],
    children: (() => XmlNode[]) | null = null,
  ): XmlNode {
    const elementOrdinal = ++ordinal;
    return {
      elementOrdinal,
      name: qname(local, XBRLI, "xbrli"),
      attributes,
      qnameAttributes: [],
      textQName: null,
      textRuns: [{ beforeChildIndex: 0, text }],
      children: children?.() ?? [],
    };
  }
  const contextRoot = xml("context", "", [attribute("id", "current")], () => [
    xml("entity", "", [], () => [
      xml("identifier", CIK, [attribute("scheme", "http://www.sec.gov/CIK")]),
    ]),
    xml("period", "", [], () => [xml("startDate", start), xml("endDate", end)]),
  ]);
  const context = {
    id: `c:${contextRoot.elementOrdinal}`,
    xmlId: "current",
    elementOrdinal: contextRoot.elementOrdinal,
    root: contextRoot,
  };
  const unitRoot = xml("unit", "", [attribute("id", "usd")], () => [
    xml("measure", "iso4217:USD"),
  ]);
  unitRoot.children[0]!.textQName = qname(
    "USD",
    "http://www.xbrl.org/2003/iso4217",
    "iso4217",
  );
  const unit = {
    id: `u:${unitRoot.elementOrdinal}`,
    xmlId: "usd",
    elementOrdinal: unitRoot.elementOrdinal,
    root: unitRoot,
  };
  const cashContexts = cashNodes.map(({ kind }) => {
    const fiscalStart = new Date(`${fiscalEnd}T00:00:00Z`);
    fiscalStart.setUTCDate(fiscalStart.getUTCDate() + 1);
    fiscalStart.setUTCFullYear(fiscalStart.getUTCFullYear() - 1);
    fiscalStart.setUTCDate(fiscalStart.getUTCDate() - 1);
    const date =
      kind === "opening" ? fiscalStart.toISOString().slice(0, 10) : end;
    const root = xml("context", "", [attribute("id", `cash-${kind}`)], () => [
      xml("entity", "", [], () => [
        xml("identifier", CIK, [attribute("scheme", "http://www.sec.gov/CIK")]),
      ]),
      xml("period", "", [], () => [xml("instant", date)]),
    ]);
    return {
      id: `c:${root.elementOrdinal}`,
      xmlId: `cash-${kind}`,
      elementOrdinal: root.elementOrdinal,
      root,
    };
  });
  facts.forEach((f) => {
    f.contextRecordId = context.id;
    f.unitRecordId = unit.id;
  });
  const metadata = [
    "DocumentType",
    "DocumentPeriodEndDate",
    "DocumentFiscalYearFocus",
    "DocumentFiscalPeriodFocus",
  ] as const;
  const values = ["10-Q", end, String(year), `Q${slot}`];
  const observations = metadata.map((concept, index) => {
    const n = ++ordinal;
    return {
      id: `d:${n}`,
      elementOrdinal: n,
      locator: `/elements/${n}`,
      factId: null,
      concept: qname(concept, DEI, "dei"),
      rawContextRef: "current",
      contextRecordId: context.id,
      rawText: values[index]!,
      format: null,
      value: values[index]!,
      issues: [],
      elementRecordId: null,
    };
  });
  named.get("html")!.endElementOrdinal = ordinal;
  named.get("html")!.childrenComplete = false;
  named.get("html")!.elementChildCount = 2;
  named.get("html")!.textRuns = null;
  const selection = {
    accessionNumber: accession,
    form: "10-Q" as const,
    filedDate: "2025-11-05",
    reportDate: end,
  };
  const cf: Input["evidence"]["companyFacts"]["occurrences"] = facts.map(
    (f) => {
      const index = PERSONAL_SEC_QUARTERLY_CONCEPTS.indexOf(
        f.concept.localName as "Revenues",
      );
      const raw = {
        accn: accession,
        start,
        end,
        form: "10-Q",
        filed: selection.filedDate,
        fy: year,
        fp: `Q${slot}`,
        val: f.value!,
      };
      return {
        id: `cf:${index}:0:0`,
        concept: f.concept.localName as "Revenues" | "NetIncomeLoss",
        sourceLocator: `/facts/us-gaap/${f.concept.localName}/units/USD/0`,
        unitKey: "USD",
        unitIndex: 0,
        rowIndex: 0,
        accessionMembership: "selected" as const,
        accessionNumber: accession,
        startDate: start,
        endDate: end,
        form: "10-Q",
        filedDate: selection.filedDate,
        fiscalYear: year,
        fiscalPeriod: `Q${slot}`,
        frame: null,
        value: f.value,
        rawFields: Object.entries(raw).map(([name, value]) => ({
          name,
          kind: name === "val" || name === "fy" ? "number" : "string",
          text: String(value),
        })),
        nonObjectRow: null,
        issues: [],
      };
    },
  );
  const primary: Mutable<PersonalSecQuarterPrimaryEvidenceDto> = {
    schemaVersion: "1.0.0",
    mode: "accession_evidence",
    documentSha256: sha("3"),
    documentBytes: 10000,
    cik: CIK,
    selection: { ...selection },
    status: "complete",
    reason: null,
    concepts: PERSONAL_SEC_QUARTERLY_CONCEPTS.map((concept) => ({
      concept,
      occurrences: facts.filter((f) => f.concept.localName === concept),
    })),
    contexts: [context],
    units: [unit],
    reportingMetadata: {
      fields: metadata.map((concept, i) => ({
        concept,
        status: "observed",
        value: values[i]!,
        observationIds: [observations[i]!.id],
      })),
      observations,
    },
    structure: {
      profileVersion: "sparse-source-1.0.0",
      status: "complete",
      reasons: [],
      document: {
        elementCount: ordinal,
        styleElements: 0,
        stylesheetLinks: 0,
        processingInstructions: [],
        scripts: [],
        eventAttributeCount: 0,
      },
      records,
      siblingWindows: [
        {
          parentRecordId: named.get("body")!.id,
          firstChildIndex: 0,
          childRecordIds: [...named.get("body")!.childRecordIds],
        },
      ],
      tables,
      supplementaryFacts: [],
      anchorRecordIds: [...named]
        .filter(([, r]) => r.name.localName === "p")
        .map(([, r]) => r.id),
    },
  };
  const registrant = named.get("registrant")!;
  primary.contexts.push(...cashContexts);
  for (const { node, kind } of cashNodes) {
    const cashContext = cashContexts.find(
      (context) => context.xmlId === `cash-${kind}`,
    )!;
    node.attributes = [
      attribute("name", "us-gaap:CashAndCashEquivalentsAtCarryingValue"),
      attribute("contextRef", cashContext.xmlId),
      attribute("unitRef", "usd"),
      attribute("decimals", "0"),
    ];
    primary.structure!.supplementaryFacts.push({
      id: `s:${node.elementOrdinal}`,
      elementOrdinal: node.elementOrdinal,
      elementRecordId: node.id,
      concept: qname("CashAndCashEquivalentsAtCarryingValue", GAAP, "us-gaap"),
      rawContextRef: cashContext.xmlId,
      contextRecordId: cashContext.id,
      rawUnitRef: "usd",
      unitRecordId: unit.id,
      format: null,
      rawText: "1",
      sign: null,
      scale: null,
      decimals: "0",
      precision: null,
      issues: [],
    });
  }
  registrant.attributes = [
    attribute("name", "dei:EntityRegistrantName"),
    attribute("contextRef", "current"),
  ];
  primary.structure!.supplementaryFacts.push({
    id: `s:${registrant.elementOrdinal}`,
    elementOrdinal: registrant.elementOrdinal,
    elementRecordId: registrant.id,
    concept: qname("EntityRegistrantName", DEI, "dei"),
    rawContextRef: "current",
    contextRecordId: context.id,
    rawUnitRef: null,
    unitRecordId: null,
    format: null,
    rawText: "Example Corporation",
    sign: null,
    scale: null,
    decimals: null,
    precision: null,
    issues: [],
  });
  const input: Input = {
    cik: CIK,
    selection,
    sources: ["submissions", "company_facts", "primary"].map((id, i) => ({
      id: id as "submissions" | "company_facts" | "primary",
      sha256: sha(String(i + 1)),
      bytes: id === "primary" ? 10000 : 1000,
      sourceUrl:
        id === "primary"
          ? `https://www.sec.gov/Archives/edgar/data/999999/${accession.replaceAll("-", "")}/report.htm`
          : `https://data.sec.gov/${id === "submissions" ? "submissions" : "api/xbrl/companyfacts"}/CIK${CIK}.json`,
      retrievalStartedAt: `2025-11-06T00:00:0${i * 2}.000Z`,
      retrievalCompletedAt: `2025-11-06T00:00:0${i * 2 + 1}.000Z`,
    })),
    evidence: {
      schemaVersion: "1.0.0",
      submission: {
        id: "submissions:selected",
        sourceId: "submissions",
        rowIndex: 0,
        matchingRowIndices: [0],
        accessionNumber: accession,
        form: "10-Q",
        filedDate: selection.filedDate,
        reportDate: end,
        acceptedAt: null,
        primaryDocument: "report.htm",
      },
      primary,
      companyFacts: {
        schemaVersion: "1.0.0",
        sourceSha256: sha("2"),
        cik: CIK,
        accessionNumber: accession,
        inspectedRows: 2,
        otherAccessionRows: 0,
        occurrences: cf,
        populations: PERSONAL_SEC_QUARTERLY_CONCEPTS.map((concept) => {
          const ids = cf.filter((f) => f.concept === concept).map((f) => f.id);
          return {
            concept,
            present: ids.length > 0,
            units: ids.length
              ? [
                  {
                    unitKey: "USD",
                    inspectedRows: ids.length,
                    otherAccessionRows: 0,
                    retainedIds: ids,
                  },
                ]
              : [],
            inspectedRows: ids.length,
            otherAccessionRows: 0,
            retainedIds: ids,
          };
        }),
      },
    },
  };
  return { input, named, facts, context, unit };
}
function assessed(input: Input) {
  expect(
    isPersonalSecQuarterPrimaryEvidence(input.evidence.primary),
    "primary graph",
  ).toBe(true);
  expect(isPersonalSecQuarterEvidence(input.evidence), "evidence joins").toBe(
    true,
  );
  expect(isPersonalSecQuarterAssessmentInput(input), "source bindings").toBe(
    true,
  );
  const result = assessPersonalSecQuarterEvidence(input);
  expect(result.status).toBe("assessed");
  if (result.status !== "assessed") throw new Error("Expected complete graph");
  expect(
    isPersonalSecQuarterAnalysis(result.analysis, input.evidence),
    "output graph",
  ).toBe(true);
  expect(result.analysis.ttm).toEqual({
    status: "unavailable",
    reason: "source_not_admitted",
  });
  return result.analysis;
}
function text(f: ReturnType<typeof fixture>, key: string, value: string) {
  const node = f.named.get(key)!;
  node.textRuns = [{ beforeChildIndex: 0, text: value }];
  const fact = f.facts.find(
    (fact) => fact.elementOrdinal === node.elementOrdinal,
  );
  if (fact) fact.rawText = value;
}
function reasons(input: Input) {
  return assessed(input).pair.reasons;
}
function addPrimary(
  f: ReturnType<typeof fixture>,
  changes: Partial<Mutable<QuarterPrimaryOccurrence>> = {},
) {
  const primary = f.input.evidence.primary;
  const ordinal = ++primary.structure!.document.elementCount;
  f.named.get("html")!.endElementOrdinal = ordinal;
  const fact = {
    ...structuredClone(f.facts[0]!),
    id: `f:${ordinal}`,
    elementOrdinal: ordinal,
    locator: `/elements/${ordinal}`,
    elementRecordId: null,
    actualTableOrdinal: null,
    actualRowOrdinal: null,
    actualCellOrdinal: null,
    ...changes,
  };
  primary.concepts
    .find((p) => p.concept === fact.concept.localName)!
    .occurrences.push(fact);
  return fact;
}
function addCompany(
  f: ReturnType<typeof fixture>,
  changes: Partial<
    Input["evidence"]["companyFacts"]["occurrences"][number]
  > = {},
) {
  const projection = f.input.evidence.companyFacts;
  const record = { ...structuredClone(projection.occurrences[0]!), ...changes };
  const values: Record<string, string | number | null> = {
    accn: record.accessionNumber,
    start: record.startDate,
    end: record.endDate,
    form: record.form,
    filed: record.filedDate,
    fy: record.fiscalYear,
    fp: record.fiscalPeriod,
    val: record.value,
  };
  record.rawFields = Object.entries(values).map(([name, value]) => ({
    name,
    kind:
      value === null
        ? "null"
        : name === "fy" || name === "val"
          ? "number"
          : "string",
    text: value === null ? "null" : String(value),
  }));
  projection.occurrences.push(record);
  projection.occurrences.sort(
    (a, b) =>
      PERSONAL_SEC_QUARTERLY_CONCEPTS.indexOf(a.concept) -
      PERSONAL_SEC_QUARTERLY_CONCEPTS.indexOf(b.concept),
  );
  projection.inspectedRows++;
  projection.populations = PERSONAL_SEC_QUARTERLY_CONCEPTS.map(
    (concept, ci) => {
      const rows = projection.occurrences.filter((r) => r.concept === concept);
      const keys = [...new Set(rows.map((r) => r.unitKey))];
      const units = keys.map((unitKey, ui) => {
        const current = rows.filter((r) => r.unitKey === unitKey);
        current.forEach((r, ri) => {
          r.unitIndex = ui;
          r.rowIndex = ri;
          r.id = `cf:${ci}:${ui}:${ri}`;
          r.sourceLocator = `/facts/us-gaap/${concept}/units/${unitKey.replaceAll("~", "~0").replaceAll("/", "~1")}/${ri}`;
        });
        return {
          unitKey,
          inspectedRows: current.length,
          otherAccessionRows: 0,
          retainedIds: current.map((r) => r.id),
        };
      });
      return {
        concept,
        present: rows.length > 0,
        inspectedRows: rows.length,
        otherAccessionRows: 0,
        retainedIds: units.flatMap((u) => u.retainedIds),
        units,
      };
    },
  );
  projection.occurrences = projection.populations.flatMap((p) =>
    p.retainedIds.map((id) => projection.occurrences.find((r) => r.id === id)!),
  );
  return record;
}

describe("selected standalone-quarter evidence", () => {
  it("admits an exact signed USD pair from a complete generic source graph", () => {
    const f = fixture();
    const before = JSON.stringify(f.input);
    const result = assessed(f.input);
    expect(result.pair).toEqual({
      status: "supported_as_filed",
      reasons: [],
      revenue: "100000000",
      netIncome: "-20000000",
      unit: "USD",
      period: { startDate: "2025-01-01", endDate: "2025-03-31" },
    });
    expect(result.witnesses).toHaveLength(2);
    expect(result.concepts).toHaveLength(4);
    expect(result.metrics).toHaveLength(2);
    expect(JSON.stringify(f.input)).toBe(before);
    expect(Object.isFrozen(result)).toBe(true);
    expect(assessPersonalSecQuarterEvidence(f.input)).toEqual({
      status: "assessed",
      analysis: result,
    });
  });
  it("derives a non-January Q3 from explicit fiscal-year evidence", () => {
    const f = fixture({
      end: "2025-03-31",
      start: "2025-01-01",
      fiscalEnd: "2025-06-30",
      slot: 3,
    });
    expect(assessed(f.input).pair.status).toBe("supported_as_filed");
  });
  it("keeps literal zero and does not infer missing income", () => {
    const f = fixture({ income: "0", displayIncome: "0" });
    expect(assessed(f.input).pair.netIncome).toBe("0");
  });
  it("keeps a 29-digit amount exact", () => {
    const value = "12345678901234567890123456789";
    expect(
      assessed(
        fixture({
          revenue: value,
          displayRevenue: value,
          units: "(dollars)",
          income: "-20",
        }).input,
      ).pair.revenue,
    ).toBe(value);
  });
  it("refuses a one-unit mismatch beyond ordinary decimal precision", () => {
    expect(
      reasons(
        fixture({
          revenue: "12345678901234567890123456789",
          displayRevenue: "12345678901234567890123456788",
          units: "(dollars)",
          income: "-20",
        }).input,
      ),
    ).toContain("display_amount_mismatch");
  });
  it.each([
    [
      "calendar",
      "Our prior fiscal year ended December 31, 2024.",
      "fiscal_boundary_unresolved",
    ],
    [
      "calendar",
      "Our fiscal year consists of 52 weeks.",
      "unsupported_week_calendar",
    ],
    [
      "quarterly",
      "☐ Quarterly report pursuant to Section 13",
      "report_identity_unresolved",
    ],
    [
      "transition",
      "☒ Transition report pursuant to Section 13",
      "report_identity_unresolved",
    ],
    [
      "cover-end",
      "For the quarterly period ended June 30, 2025",
      "report_identity_unresolved",
    ],
    [
      "income-heading",
      "Revenue by reportable segment",
      "caption_ownership_unresolved",
    ],
    [
      "section",
      "Notes to the consolidated financial statements",
      "principal_statement_unresolved",
    ],
    [
      "balance-heading",
      "Selected supplemental assets",
      "principal_statement_unresolved",
    ],
    ["duration", "Six months ended", "column_ownership_conflict"],
    ["year", "March 31, 2024", "column_ownership_conflict"],
    ["year", "June 30, 2025", "column_ownership_conflict"],
    ["rev-label", "Product revenues", "whole_revenue_scope_unresolved"],
    [
      "ni-label",
      "Net income available to common shareholders",
      "unsupported_common_share_numerator",
    ],
    [
      "ni-label",
      "Income from continuing operations",
      "unsupported_continuing_income",
    ],
    [
      "income-units",
      "Amounts in billions of dollars",
      "display_unit_unresolved",
    ],
    ["income-units", "(in millions of euros)", "display_unit_unresolved"],
    ["rev-fact", "100)", "display_amount_unresolved"],
  ])("holds unsupported source text at %s: %s", (key, value, reason) => {
    const f = fixture();
    text(f, key, value);
    expect(reasons(f.input)).toContain(reason);
  });
  it("requires exact full-cell year ownership", () => {
    const f = fixture();
    const t = f.input.evidence.primary.structure!.tables.find(
      (t) => t.tableRecordId === f.named.get("income")!.id,
    )!;
    t.rows[2]!.cells[2]!.columnSpan = 2;
    t.rows[2]!.cells[3]!.columnStart = 4;
    f.named.get("rev-number")!.attributes = [attribute("colspan", "2")];
    expect(reasons(f.input)).toContain("current_column_unresolved");
  });
  it("accepts split closing parentheses with blank headers", () => {
    const f = fixture();
    f.named.get("ni-number")!.textRuns = [{ beforeChildIndex: 0, text: "(" }];
    text(f, "ni-close", ")");
    expect(assessed(f.input).pair.netIncome).toBe("-20000000");
  });
  it("rejects a comparative year over the closing punctuation", () => {
    const f = fixture();
    f.named.get("ni-number")!.textRuns = [{ beforeChildIndex: 0, text: "(" }];
    text(f, "ni-close", ")");
    text(f, "year-close", "2024");
    expect(reasons(f.input)).toContain("adjacent_cell_ownership_conflict");
  });
  it("admits ordinary net income only through a current wholly-owned scope", () => {
    const f = fixture();
    text(f, "ni-label", "Net income (loss)");
    expect(assessed(f.input).pair.status).toBe("supported_as_filed");
    text(
      f,
      "consolidation",
      "The consolidated financial statements include the accounts of the company and its majority-owned subsidiaries.",
    );
    expect(reasons(f.input)).toContain("parent_attribution_unresolved");
  });
  it.each([
    "display:none",
    "opacity:0",
    "color:white",
    "transform:scale(0)",
    "font-size:0pt",
    "position:absolute;left:-999px",
    "unknown-layout:normal",
  ])("holds unknown or hiding selected styles: %s", (style) => {
    const f = fixture();
    f.named.get("ni-fact")!.attributes.push(attribute("style", style));
    expect(reasons(f.input)).toContain("static_visibility_unresolved");
  });
  it("holds any retained script, including a terminal external script", () => {
    const f = fixture();
    const n = f.input.evidence.primary.structure!.document.elementCount;
    f.input.evidence.primary.structure!.document.scripts.push({
      elementOrdinal: n,
      name: qname("script"),
      attributes: [attribute("src", "external.js")],
      inlineTextCharacters: 0,
      lastDocumentElementOrdinal: n,
    });
    expect(reasons(f.input)).toContain("static_script_unresolved");
  });
  it.each(["styleElements", "stylesheetLinks", "eventAttributeCount"] as const)(
    "holds document-wide %s",
    (field) => {
      const f = fixture();
      f.input.evidence.primary.structure!.document[field] = 1;
      expect(reasons(f.input)).toContain("static_visibility_unresolved");
    },
  );
  it("holds a stylesheet processing instruction", () => {
    const f = fixture();
    f.input.evidence.primary.structure!.document.processingInstructions.push({
      locator: "/processing-instruction/1",
      target: "xml-stylesheet",
    });
    expect(reasons(f.input)).toContain("static_visibility_unresolved");
  });
  it("rejects corrupted graph identity without exposing values", () => {
    const f = fixture();
    f.input.cik = "0000000001";
    expect(assessPersonalSecQuarterEvidence(f.input)).toEqual({
      status: "unavailable",
      reason: "invalid_evidence_graph",
      ttm: { status: "unavailable", reason: "source_not_admitted" },
    });
  });
  it("keeps equal Company Facts duplicates and maps both to the visible witness", () => {
    const f = fixture();
    addCompany(f);
    const result = assessed(f.input);
    expect(result.pair.status).toBe("supported_as_filed");
    expect(
      result.witnesses.find((w) => w.concept === "Revenues")!.companyFactsRefs,
    ).toEqual(["cf:1:0:0", "cf:1:0:1"]);
  });
  it("withholds a primary-only income instead of emitting an empty correspondence witness", () => {
    const f = fixture();
    const cf = f.input.evidence.companyFacts;
    cf.occurrences = cf.occurrences.filter(
      (row) => row.concept !== "NetIncomeLoss",
    );
    cf.inspectedRows = 1;
    cf.populations[3] = {
      concept: "NetIncomeLoss",
      present: false,
      units: [],
      inspectedRows: 0,
      otherAccessionRows: 0,
      retainedIds: [],
    };
    const result = assessed(f.input);
    expect(result.metrics[0]!.status).toBe("supported_as_filed");
    expect(result.metrics[1]!.reasons).toContain(
      "no_current_company_facts_row",
    );
    expect(result.witnesses).toHaveLength(1);
    expect(result.pair.revenue).toBeNull();
    expect(result.pair.netIncome).toBeNull();
  });
  it("retains an agreeing off-table duplicate without inventing a second witness", () => {
    const f = fixture();
    const duplicate = addPrimary(f);
    const result = assessed(f.input);
    expect(result.pair.status).toBe("supported_as_filed");
    expect(result.concepts[1]!.primaryRefs).toContain(duplicate.id);
    expect(
      result.witnesses.filter((w) => w.concept === "Revenues"),
    ).toHaveLength(1);
  });
  it("blocks a hidden or off-table current USD contradiction", () => {
    const f = fixture();
    addPrimary(f, { value: "999000000", rawText: "999" });
    const result = assessed(f.input);
    expect(result.pair.status).toBe("conflicted");
    expect(result.pair.reasons).toContain("current_value_conflict");
    expect(result.pair.revenue).toBeNull();
  });
  it("holds a differing EUR alternative without claiming a comparable USD conflict", () => {
    const f = fixture();
    addCompany(f, { value: "777", unitKey: "EUR" });
    const result = assessed(f.input);
    expect(result.pair.status).toBe("held");
    expect(result.pair.reasons).toContain("current_non_usd");
    expect(result.pair.reasons).not.toContain("current_value_conflict");
  });
  it("blocks a second unresolved current revenue alias before witness ranking", () => {
    const f = fixture();
    addCompany(f, { concept: "SalesRevenueNet" });
    const result = assessed(f.input);
    expect(result.metrics[0]!.reasons).toEqual(["competing_revenue_concepts"]);
    expect(result.pair.revenue).toBeNull();
  });
  it("allows a positively excluded comparative alias", () => {
    const f = fixture();
    addCompany(f, {
      concept: "SalesRevenueNet",
      startDate: "2024-01-01",
      endDate: "2024-03-31",
    });
    expect(assessed(f.input).pair.status).toBe("supported_as_filed");
  });
  it("does not exclude a comparative-looking CF row with unsupported structural fields", () => {
    const f = fixture();
    const row = addCompany(f, {
      concept: "SalesRevenueNet",
      startDate: "2024-01-01",
      endDate: "2024-03-31",
      issues: ["unsupported_row_fields"],
    });
    row.rawFields.push({ name: "sourceScope", kind: "object", text: "{}" });
    const result = assessed(f.input);
    expect(result.concepts[2]!.memberships[0]!.disposition).toBe("unresolved");
    expect(result.metrics[0]!.reasons).toContain("competing_revenue_concepts");
  });
  it("does not exclude malformed fiscal metadata on an apparent comparative CF row", () => {
    const f = fixture();
    const row = addCompany(f, {
      concept: "SalesRevenueNet",
      startDate: "2024-01-01",
      endDate: "2024-03-31",
      fiscalYear: null,
      issues: ["invalid_fiscal_year"],
    });
    Object.assign(
      row.rawFields.find((r) => r.name === "fy")!,
      { kind: "string", text: "2024" },
    );
    expect(assessed(f.input).metrics[0]!.reasons).toContain(
      "competing_revenue_concepts",
    );
  });
  it("can exclude an invalid numeric value when all structural period fields are valid", () => {
    const f = fixture();
    const row = addCompany(f, {
      concept: "SalesRevenueNet",
      startDate: "2024-01-01",
      endDate: "2024-03-31",
      value: null,
      issues: ["invalid_numeric"],
    });
    Object.assign(
      row.rawFields.find((r) => r.name === "val")!,
      { kind: "string", text: "unavailable" },
    );
    expect(assessed(f.input).pair.status).toBe("supported_as_filed");
  });
  it("refuses to borrow an unrelated calendar sentence", () => {
    const f = fixture();
    text(
      f,
      "calendar",
      "Other Entity financial statements describe its fiscal year ending December 31, 2025 and calendar months.",
    );
    expect(reasons(f.input)).toContain("fiscal_boundary_unresolved");
  });
  it("does not use another entity's wholly-owned note", () => {
    const f = fixture();
    text(f, "ni-label", "Net income (loss)");
    text(
      f,
      "consolidation",
      "The accompanying consolidated financial statements include the accounts of Other Corporation and its wholly-owned subsidiaries.",
    );
    expect(reasons(f.input)).toContain("parent_attribution_unresolved");
  });
  it("holds a revenue category above the numerical row", () => {
    const f = fixture();
    text(f, "year-blank", "Domestic operations");
    expect(reasons(f.input)).toContain("whole_revenue_scope_unresolved");
  });
  it("refuses checked and unchecked controls gathered from different source blocks", () => {
    const f = fixture({ separateCover: true });
    expect(reasons(f.input)).toContain("report_identity_unresolved");
  });
  it.each([2, 3] as const)(
    "derives Q%s from a principal fiscal-YTD opening/closing date chain",
    (slot) => {
      const f = fixture({
        calendarMethod: "cash",
        slot,
        start: slot === 2 ? "2025-04-01" : "2025-07-01",
        end: slot === 2 ? "2025-06-30" : "2025-09-30",
      });
      const result = assessed(f.input);
      expect(result.pair.status).toBe("supported_as_filed");
      expect(
        result.predicates.some(
          (p) =>
            p.profile === "calendar_fiscal_ytd_roles_v1" &&
            p.state === "supported",
        ),
      ).toBe(true);
    },
  );
  it("holds a cash roll-forward with the wrong opening date", () => {
    const f = fixture({
      calendarMethod: "cash",
      slot: 2,
      start: "2025-04-01",
      end: "2025-06-30",
    });
    f.input.evidence.primary.contexts[1]!.root.children[1]!.children[0]!.textRuns[0]!.text =
      "2025-03-31";
    expect(reasons(f.input)).toContain("fiscal_ytd_role_unresolved");
  });
  it("holds a quarter-only cash column used as fiscal-YTD evidence", () => {
    const f = fixture({
      calendarMethod: "cash",
      slot: 2,
      start: "2025-04-01",
      end: "2025-06-30",
    });
    text(f, "cash-duration", "Three months ended");
    expect(reasons(f.input)).toContain("fiscal_ytd_role_unresolved");
  });
  it("does not borrow a prior-year twelve-month convention to bypass current cash-role evidence", () => {
    const f = fixture();
    text(
      f,
      "calendar",
      "These consolidated financial statements are for the current fiscal year ending December 31, 2025.",
    );
    text(
      f,
      "consolidation",
      "Our fiscal year ending December 31, 2024 consists of twelve calendar months.",
    );
    expect(reasons(f.input)).toContain("fiscal_ytd_role_unresolved");
  });
  it.each(["table", "column"] as const)(
    "does not pool opening and closing date roles across a different %s",
    (splitCash) => {
      const f = fixture({
        calendarMethod: "cash",
        slot: 2,
        start: "2025-04-01",
        end: "2025-06-30",
        splitCash,
      });
      const result = assessed(f.input);
      expect(
        result.predicates.find(
          (p) => p.profile === "calendar_fiscal_ytd_roles_v1",
        )!.state,
      ).toBe("unresolved");
      expect(result.pair.reasons).toContain("fiscal_ytd_role_unresolved");
    },
  );
  it.each(["GBP", "JPY", "Percentages"])(
    "does not discard a competing %s display header next to millions",
    (label) => {
      const f = fixture();
      text(f, "year-currency", label);
      const income = assessed(f.input).metrics[1]!;
      expect(income.status).toBe("held");
      expect(income.reasons).toContain("display_unit_unresolved");
    },
  );
  it("withholds parent income beneath an inherited continuing-operations category", () => {
    const f = fixture();
    text(f, "year-blank", "Continuing operations");
    expect(assessed(f.input).metrics[1]!.status).toBe("held");
  });
  it("uses complete same-container cover siblings even when only report-end is an anchor", () => {
    const f = fixture();
    const controls = [
      f.named.get("quarterly")!.id,
      f.named.get("transition")!.id,
    ];
    f.input.evidence.primary.structure!.anchorRecordIds =
      f.input.evidence.primary.structure!.anchorRecordIds.filter(
        (id) => !controls.includes(id),
      );
    expect(assessed(f.input).pair.status).toBe("supported_as_filed");
  });
});
