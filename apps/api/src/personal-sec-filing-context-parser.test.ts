import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";

import {
  PERSONAL_SEC_FILING_CONTEXT_LIMITS as LIMITS,
  PERSONAL_SEC_FILING_CONTEXT_SCHEMA_VERSION,
  PERSONAL_SEC_FILING_DEI_NAMESPACES,
  PERSONAL_SEC_FILING_REPORTING_CONCEPTS,
  createEmptyPersonalSecFilingReportingMetadata,
  type PersonalSecFilingContextIssue,
  type PersonalSecFilingContextSelectionDto,
} from "@research-cockpit/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createPersonalSecFilingContextParser,
  type PersonalSecFilingContextParser,
} from "./personal-sec-filing-context-parser";

const selection: PersonalSecFilingContextSelectionDto = Object.freeze({
  id: `sec-fact:${"a".repeat(64)}`,
  metric: "revenue",
  taxonomy: "us-gaap",
  concept: "Revenues",
  unit: "USD",
  value: "100",
  startDate: "2025-01-01",
  endDate: "2025-03-31",
  accessionNumber: "0000000042-25-000001",
  form: "10-Q",
  filedDate: "2025-05-01",
});
const parsers: PersonalSecFilingContextParser[] = [];
function emptyResult(reason: PersonalSecFilingContextIssue | null = null) {
  const metadata = createEmptyPersonalSecFilingReportingMetadata();
  return {
    schemaVersion: PERSONAL_SEC_FILING_CONTEXT_SCHEMA_VERSION,
    status: reason === null ? "no_corresponding_fact" : "unsupported",
    reason,
    candidates: [],
    correspondingCandidateLocators: [],
    reportingMetadata:
      reason === null
        ? metadata
        : {
            status: "unavailable",
            reason,
            observations: [],
            fields: metadata.fields.map((field) => ({
              ...field,
              status: "unsupported",
            })),
          },
  };
}
function parser(): PersonalSecFilingContextParser {
  const value = createPersonalSecFilingContextParser();
  parsers.push(value);
  return value;
}
afterEach(() => {
  for (const value of parsers.splice(0)) value.close();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

function context(
  id = "c",
  start = "2025-01-01",
  end = "2025-03-31",
  entity = "0000000042",
  extra = "",
): string {
  return `<xbrli:context id="${id}"><xbrli:entity><xbrli:identifier scheme="http://www.sec.gov/CIK">${entity}</xbrli:identifier>${extra}</xbrli:entity><xbrli:period><xbrli:startDate>${start}</xbrli:startDate><xbrli:endDate>${end}</xbrli:endDate></xbrli:period></xbrli:context>`;
}
function fact(value = "100", attributes = "", contextId = "c"): string {
  return `<ix:nonFraction name="us-gaap:Revenues" contextRef="${contextId}" unitRef="u" decimals="0" ${attributes}>${value}</ix:nonFraction>`;
}
function document(
  facts = fact(),
  contexts = context(),
  unit = '<xbrli:unit id="u"><xbrli:measure>iso4217:USD</xbrli:measure></xbrli:unit>',
): string {
  return `<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:ix="http://www.xbrl.org/2013/inlineXBRL" xmlns:xbrli="http://www.xbrl.org/2003/instance" xmlns:xbrldi="http://xbrl.org/2006/xbrldi" xmlns:us-gaap="http://fasb.org/us-gaap/2025" xmlns:iso4217="http://www.xbrl.org/2003/iso4217" xmlns:ixt="http://www.xbrl.org/inlineXBRL/transformation/2020-02-12"><head><meta charset="utf-8"/></head><body><ix:header><ix:resources>${contexts}${unit}</ix:resources></ix:header>${facts}</body></html>`;
}
function parse(
  html = document(),
  override: Partial<PersonalSecFilingContextSelectionDto> = {},
) {
  return parser().parse({
    document: new TextEncoder().encode(html),
    cik: "0000000042",
    selection: { ...selection, ...override },
  });
}

describe("selected SEC filing context real isolated worker", () => {
  const linkingAttributes = [
    ["2013", "relationship", "fromRefs"],
    ["2013", "relationship", "toRefs"],
    ["2013", "relationship", "linkRole"],
    ["2013", "footnote", "footnoteRole"],
    ["2008", "footnote", "footnoteID"],
    ["2008", "footnote", "footnoteLinkRole"],
    ["2008", "footnote", "footnoteRole"],
  ] as const;

  it.each(linkingAttributes)(
    "traverses canonical %s %s %s without adding fact evidence",
    async (year, element, attribute) => {
      const html = metadataDocument();
      const node = `<ix:${element} xmlns:ix="http://www.xbrl.org/${year}/inlineXBRL" ${attribute}="unresolved-reference"/>`;
      expect(await parse(html.replace("</body>", `${node}</body>`))).toEqual(
        await parse(html),
      );
    },
  );

  it.each(linkingAttributes)(
    "rejects case variants of %s %s %s",
    async (year, element, attribute) => {
      for (const wrongCase of [
        attribute.toLowerCase(),
        attribute.toUpperCase(),
      ]) {
        const node = `<ix:${element} xmlns:ix="http://www.xbrl.org/${year}/inlineXBRL" ${wrongCase}="x"/>`;
        expect(await parse(document(fact() + node))).toEqual(
          emptyResult("invalid_document"),
        );
      }
    },
  );

  it.each([
    '<ix:relationship xmlns:ix="http://www.xbrl.org/2008/inlineXBRL" fromRefs="x"/>',
    '<ix:footnote footnoteID="x"/>',
    '<ix:footnote footnoteLinkRole="x"/>',
    '<ix:references fromRefs="x"/>',
    '<ix:relationship footnoteRole="x"/>',
    '<ix:footnote linkRole="x"/>',
    '<xbrli:context fromRefs="x"/>',
    '<xbrldi:explicitMember footnoteRole="x"/>',
    '<ix:relationship fromRefs="x" fromrefs="y"/>',
    "<ix:relationship fromRefs=x/>",
    '<ix:relationship fromRefs="x" continuationFrom="y"/>',
  ])("keeps linking names scoped and XML syntax strict: %s", async (node) => {
    expect(await parse(document(fact() + node))).toEqual(
      emptyResult("invalid_document"),
    );
  });

  it("does not resolve standard links or use them to clear numeric or metadata issues", async () => {
    const links =
      '<ix:relationship fromRefs="missing-fact" toRefs="missing-note" linkRole="urn:synthetic:role" arcrole="urn:synthetic:arc"/>' +
      '<ix:footnote id="note" footnoteRole="urn:synthetic:note">Uninterpreted note</ix:footnote>';
    const html = metadataDocument(
      metadataFact(
        "DocumentPeriodEndDate",
        "March 31, 2025",
        'format="ixt:date-monthname-day-year-en"',
      ),
    ).replace('decimals="0"', 'decimals="0" continuedAt="missing"');
    const baseline = await parse(html);
    expect(baseline.reason).toBe("unsupported_inline");
    expect(baseline.reportingMetadata.fields[1]?.status).toBe("unsupported");
    expect(await parse(html.replace("</body>", `${links}</body>`))).toEqual(
      baseline,
    );
  });

  it("keeps a linking child inside a numeric fact unsupported", async () => {
    const result = await parse(
      document(
        fact().replace(
          "100</ix:nonFraction>",
          '100<ix:relationship fromRefs="x" toRefs="y"/></ix:nonFraction>',
        ),
      ),
    );
    expect(result.status).toBe("unsupported");
    expect(result.reason).toBe("unsupported_inline");
    expect(result.correspondingCandidateLocators).toEqual([]);
  });

  it.each([
    '<?xml version="1.0" encoding="ASCII"?>',
    "<?xml version='1.0' encoding='US-ASCII'?>",
    '<?xml version="1.0" encoding="ascii"?>',
    "<?xml version = '1.0' encoding = \"us-ascii\" ?>",
    '<?xml\tversion\r\n=\t"1.0"\nencoding = "UTF-8"?>',
    "<?xml version='1.0' encoding='utf-8'?>",
    '<?xml version="1.0"?>',
  ])("accepts the bounded leading declaration %s", async (declaration) => {
    expect(await parse(declaration + document())).toEqual(await parse());
  });

  it.each([
    '<?xml version="1.0" encoding="ASCII"?>',
    '<?xml version="1.0" encoding="US-ASCII"?>',
  ])("requires actual ASCII bytes for %s", async (declaration) => {
    const nonAscii = document().replace("<body>", "<body>caf\u00e9");
    expect(await parse(declaration + nonAscii)).toEqual(
      emptyResult("invalid_document"),
    );
    expect(await parse("\ufeff" + declaration + document())).toEqual(
      emptyResult("invalid_document"),
    );
  });

  it("retains UTF-8 and optional UTF-8 BOM support for non-ASCII text", async () => {
    const html = document().replace("<body>", "<body>caf\u00e9");
    const declared = '<?xml version="1.0" encoding="UTF-8"?>' + html;
    expect(await parse(declared)).toEqual(await parse(html));
    expect(await parse("\ufeff" + declared)).toEqual(await parse(html));
  });

  it.each([
    '<?XML version="1.0" encoding="ASCII"?>',
    '<?xml Version="1.0" encoding="ASCII"?>',
    '<?xml version="1.0" Encoding="ASCII"?>',
    '<?xml version="1.1" encoding="ASCII"?>',
    "<?xml version=\"1.0' encoding='ASCII'?>",
    "<?xml version='1.0' encoding=\"ASCII'?>",
    '<?xml version="1.0" encoding="UTF-16"?>',
    '<?xml version="1.0" encoding="ISO-8859-1"?>',
    '<?xml version="1.0" encoding="Windows-1252"?>',
    '<?xml version="1.0" encoding="UTF8"?>',
    '<?xml version="1.0" encoding="ASC\u0130I"?>',
    '<?xml version="1.0" encoding="ASC\u0131I"?>',
    '<?xml version="1.0" encoding="A\u017fCII"?>',
    '<?xml version="1.0" encoding="ASCII" encoding="UTF-8"?>',
    '<?xml encoding="ASCII" version="1.0"?>',
    '<?xml version="1.0" standalone="yes"?>',
    '<?xml version="1.0" encoding="ASCII">',
    '<?xml\u00a0version="1.0" encoding="ASCII"?>',
    '<?xml-stylesheet href="local"?>',
  ])("rejects unsupported or malformed declaration %s", async (declaration) => {
    expect(await parse(declaration + document())).toEqual(
      emptyResult("invalid_document"),
    );
  });

  it.each([
    " ",
    "\n",
    "<!-- earlier content -->",
    "<!DOCTYPE html>",
    '<?xml version="1.0" encoding="ASCII"?>',
  ])("rejects a declaration after prior input %s", async (prefix) => {
    expect(
      await parse(
        prefix + '<?xml version="1.0" encoding="ASCII"?>' + document(),
      ),
    ).toEqual(emptyResult("invalid_document"));
  });

  it("preserves exact fact/context/entity/unit and locator provenance", async () => {
    const result = await parse(document(fact("100", 'id="revenue-fact"')));
    expect(result.status).toBe("matched");
    expect(result.reason).toBeNull();
    expect(result.candidates).toHaveLength(1);
    expect(result.correspondingCandidateLocators).toEqual([
      result.candidates[0]?.locator,
    ]);
    expect(result.candidates[0]).toMatchObject({
      factId: "revenue-fact",
      contextId: "c",
      unitId: "u",
      concept: {
        raw: "us-gaap:Revenues",
        namespace: "http://fasb.org/us-gaap/2025",
        localName: "Revenues",
      },
      entityIdentifier: "0000000042",
      entityScheme: "http://www.sec.gov/CIK",
      entityCik: "0000000042",
      dimensions: [],
      periodKind: "duration",
      startDate: "2025-01-01",
      endDate: "2025-03-31",
      unit: "USD",
      unitMeasures: [
        {
          raw: "iso4217:USD",
          namespace: "http://www.xbrl.org/2003/iso4217",
          localName: "USD",
        },
      ],
      rawText: "100",
      format: null,
      scale: null,
      sign: null,
      decimals: "0",
      precision: null,
      value: "100",
      issues: [],
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.candidates[0]?.concept)).toBe(true);
    expect(Object.isFrozen(result.candidates[0]?.unitMeasures)).toBe(true);
  });

  it.each([
    ["9007199254740993.123456789", "", "9007199254740993.123456789"],
    ["1".repeat(64), "", "1".repeat(64)],
    ["0.0001", 'scale="-6"', "0.0000000001"],
    ["1,234.50", 'format="ixt:num-dot-decimal" scale="3" sign="-"', "-1234500"],
    ["1.234,50", 'format="ixt:num-comma-decimal"', "1234.5"],
    ["(not reported)", 'format="ixt:fixed-zero" sign="-"', "0"],
    ["000.000", 'sign="-"', "0"],
  ])("normalizes %s losslessly", async (raw, attrs, expected) => {
    const result = await parse(document(fact(raw, attrs)), { value: expected });
    expect(result.status).toBe("matched");
    expect(result.candidates[0]?.rawText).toBe(raw);
    expect(result.candidates[0]?.value).toBe(expected);
  });

  it("supports the exact legacy transform namespace while preserving source format", async () => {
    const html = document(fact("1,000", 'format="ixt:numdotdecimal"')).replace(
      "transformation/2020-02-12",
      "transformation/2015-02-26",
    );
    const result = await parse(html, { value: "1000" });
    expect(result.status).toBe("matched");
    expect(result.candidates[0]?.format).toEqual({
      raw: "ixt:numdotdecimal",
      namespace: "http://www.xbrl.org/inlineXBRL/transformation/2015-02-26",
      localName: "numdotdecimal",
    });
  });

  it("does not select a preferred duplicate or round conflicting values", async () => {
    const result = await parse(
      document(
        fact("100", 'id="a"') +
          fact("100", 'id="b"') +
          fact("100.0000000000000000001", 'id="d"'),
      ),
    );
    expect(result.status).toBe("ambiguous");
    expect(result.candidates.map((row) => row.factId)).toEqual(["a", "b", "d"]);
    expect(result.correspondingCandidateLocators).toHaveLength(3);
  });

  it("keeps equivalent duplicate references and signals one different exact value", async () => {
    const equal = await parse(
      document(fact("100", 'id="a"') + fact("100.0", 'id="b"')),
    );
    expect(equal.status).toBe("matched");
    expect(equal.correspondingCandidateLocators).toHaveLength(2);
    const different = await parse(document(fact("101")));
    expect(different.status).toBe("value_differs");
    expect(different.candidates[0]?.value).toBe("101");
  });

  it("compares exact period/entity coordinates while retaining other durations", async () => {
    const contexts =
      context() +
      context("six", "2024-10-01") +
      context("nine", "2024-07-01") +
      context("other", "2025-01-01", "2025-03-31", "7");
    const result = await parse(
      document(
        fact() +
          fact("600", "", "six") +
          fact("900", "", "nine") +
          fact("400", "", "other"),
        contexts,
      ),
    );
    expect(result.status).toBe("matched");
    expect(result.candidates.map((row) => row.issues)).toEqual([
      [],
      ["period_mismatch"],
      ["period_mismatch"],
      ["entity_mismatch"],
    ]);
    expect(result.correspondingCandidateLocators).toHaveLength(1);
  });

  it("does not infer quarter labels or corresponding facts from similar aliases", async () => {
    const result = await parse(
      document(fact().replace("Revenues", "SalesRevenueNet")),
    );
    expect(result).toEqual(emptyResult());
    expect(
      (
        await parse(
          document(
            fact("100", "", "different"),
            context("different", "2024-10-01"),
          ),
        )
      ).status,
    ).toBe("no_corresponding_fact");
  });

  it("preserves dimensions and withholds a clean candidate when matching scope is unresolved", async () => {
    const dimensional = context(
      "segment",
      "2025-01-01",
      "2025-03-31",
      "42",
      '<xbrli:segment><xbrldi:explicitMember dimension="us-gaap:StatementBusinessSegmentsAxis">us-gaap:SegmentsMember</xbrldi:explicitMember></xbrli:segment>',
    );
    const result = await parse(
      document(fact() + fact("50", "", "segment"), context() + dimensional),
    );
    expect(result.status).toBe("unsupported");
    expect(result.reason).toBe("unsupported_dimensions");
    expect(result.correspondingCandidateLocators).toHaveLength(1);
    expect(result.candidates[1]?.dimensions).toEqual([
      {
        kind: "explicit",
        dimension: {
          raw: "us-gaap:StatementBusinessSegmentsAxis",
          namespace: "http://fasb.org/us-gaap/2025",
          localName: "StatementBusinessSegmentsAxis",
        },
        member: {
          raw: "us-gaap:SegmentsMember",
          namespace: "http://fasb.org/us-gaap/2025",
          localName: "SegmentsMember",
        },
        typedText: null,
      },
    ]);
  });

  it("preserves typed dimension text without XML/HTML markup", async () => {
    const ctx = context(
      "c",
      "2025-01-01",
      "2025-03-31",
      "42",
      '<xbrli:segment><xbrldi:typedMember dimension="us-gaap:SomeAxis"><span>&lt;script&gt;never execute&lt;/script&gt;</span></xbrldi:typedMember></xbrli:segment>',
    );
    const result = await parse(document(fact(), ctx));
    expect(result.status).toBe("unsupported");
    expect(result.candidates[0]?.dimensions[0]?.typedText).toBe(
      "<script>never execute</script>",
    );
  });

  it.each([
    [
      "spoofed taxonomy",
      (html: string) =>
        html.replace(
          "http://fasb.org/us-gaap/2025",
          "https://attacker.example/us-gaap/2025",
        ),
      "invalid_namespace",
    ],
    [
      "spoofed entity scheme",
      (html: string) =>
        html.replace("http://www.sec.gov/CIK", "https://attacker.example/CIK"),
      "unsupported_entity",
    ],
    [
      "missing context",
      (html: string) => html.replace('contextRef="c"', 'contextRef="missing"'),
      "unresolved_context",
    ],
    [
      "missing unit",
      (html: string) => html.replace('unitRef="u"', 'unitRef="missing"'),
      "unresolved_unit",
    ],
    [
      "duplicate context",
      (html: string) =>
        html.replace("</ix:resources>", `${context()}</ix:resources>`),
      "duplicate_id",
    ],
    [
      "hostile reference",
      (html: string) => html.replace('contextRef="c"', 'contextRef="../../c"'),
      "invalid_identifier",
    ],
    [
      "malformed tree",
      (html: string) => html.replace("</xbrli:entity>", "</span>"),
      "invalid_document",
    ],
    [
      "DTD entity",
      (html: string) =>
        html.replace(
          "<!DOCTYPE html>",
          '<!DOCTYPE html [<!ENTITY secret SYSTEM "file:///private">]>',
        ),
      "invalid_document",
    ],
    [
      "duplicate namespace attribute",
      (html: string) => html.replace("<html ", '<html xmlns:ix="bad" '),
      "invalid_document",
    ],
    [
      "case-sensitive prefix conflation",
      (html: string) => html.replace("xmlns:us-gaap", "xmlns:US-GAAP"),
      "invalid_namespace",
    ],
    [
      "case-sensitive namespace declaration keyword",
      (html: string) => html.replace("xmlns:us-gaap", "XMLNS:us-gaap"),
      "invalid_namespace",
    ],
    [
      "case-sensitive inline local name",
      (html: string) => html.replaceAll("ix:nonFraction", "ix:NonFraction"),
      "invalid_document",
    ],
    [
      "case-sensitive inline reference attribute",
      (html: string) => html.replace("contextRef", "contextref"),
      "invalid_document",
    ],
    [
      "case-sensitive period local name",
      (html: string) => html.replaceAll("xbrli:startDate", "xbrli:startdate"),
      "invalid_document",
    ],
    [
      "case-sensitive semantic closing tag",
      (html: string) => html.replace("</ix:nonFraction>", "</ix:nonfraction>"),
      "invalid_document",
    ],
    [
      "unquoted semantic XML attributes",
      (html: string) => html.replace('contextRef="c"', "contextRef=c"),
      "invalid_document",
    ],
    [
      "unknown transform",
      (html: string) =>
        html.replace('decimals="0"', 'decimals="0" format="ixt:made-up"'),
      "unsupported_transform",
    ],
    [
      "spoofed transform",
      (html: string) =>
        html
          .replace('decimals="0"', 'decimals="0" format="ixt:fixed-zero"')
          .replace(
            "http://www.xbrl.org/inlineXBRL/transformation/2020-02-12",
            "https://evil.test/transformation/2020-02-12",
          ),
      "unsupported_transform",
    ],
    [
      "continuation",
      (html: string) =>
        html.replace('decimals="0"', 'decimals="0" continuedAt="x"'),
      "unsupported_inline",
    ],
    [
      "alternate target",
      (html: string) =>
        html.replace('decimals="0"', 'decimals="0" target="other"'),
      "unsupported_inline",
    ],
    [
      "markup numeric",
      (html: string) =>
        html.replace(
          ">100</ix:nonFraction>",
          "><span>100</span></ix:nonFraction>",
        ),
      "unsupported_inline",
    ],
    [
      "inline nil",
      (html: string) =>
        html.replace(
          'decimals="0"',
          'decimals="0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:nil="true"',
        ),
      "unsupported_inline",
    ],
    [
      "negative text",
      (html: string) =>
        html.replace(">100</ix:nonFraction>", ">-100</ix:nonFraction>"),
      "invalid_numeric",
    ],
    [
      "exponent text",
      (html: string) =>
        html.replace(">100</ix:nonFraction>", ">1e2</ix:nonFraction>"),
      "invalid_numeric",
    ],
    [
      "excessive exact decimal",
      (html: string) =>
        html.replace(
          ">100</ix:nonFraction>",
          `>${"1".repeat(65)}</ix:nonFraction>`,
        ),
      "decimal_limit",
    ],
  ])(
    "reports %s without a successful partial prefix",
    async (_label, mutate, reason) => {
      const result = await parse(mutate(document()));
      expect(result.status).toBe("unsupported");
      expect(result.reason).toBe(reason);
      expect(result.correspondingCandidateLocators).toEqual([]);
    },
  );

  it("preserves complex unit measures but never treats a ratio as dollars", async () => {
    const unit =
      '<xbrli:unit id="u"><xbrli:divide><xbrli:unitNumerator><xbrli:measure>iso4217:USD</xbrli:measure></xbrli:unitNumerator><xbrli:unitDenominator><xbrli:measure>xbrli:shares</xbrli:measure></xbrli:unitDenominator></xbrli:divide></xbrli:unit>';
    const result = await parse(document(fact(), context(), unit));
    expect(result.reason).toBe("unsupported_unit");
    expect(result.candidates[0]?.unitMeasures).toHaveLength(2);
    expect(result.candidates[0]?.unit).toBeNull();
  });

  it("resolves lexical prefix scope instead of trusting conventional prefix names", async () => {
    const renamed = document()
      .replaceAll("us-gaap:", "gaap:")
      .replace("xmlns:us-gaap", "xmlns:gaap");
    expect((await parse(renamed)).status).toBe("matched");
    const shadowed = document(
      fact("100", 'xmlns:us-gaap="https://attacker.example/gaap"'),
    );
    expect((await parse(shadowed)).reason).toBe("invalid_namespace");
  });

  it("does not accept misplaced period or entity components", async () => {
    const misplaced = context().replace(
      "</xbrli:context>",
      "<xbrli:startDate>2024-01-01</xbrli:startDate></xbrli:context>",
    );
    expect((await parse(document(fact(), misplaced))).reason).toBe(
      "malformed_context",
    );
    const duplicate = context().replace(
      "</xbrli:entity>",
      '<xbrli:identifier scheme="http://www.sec.gov/CIK">42</xbrli:identifier></xbrli:entity>',
    );
    expect((await parse(document(fact(), duplicate))).reason).toBe(
      "malformed_context",
    );
    const zero = context("c", "2025-01-01", "2025-03-31", "0");
    expect((await parse(document(fact(), zero))).reason).toBe(
      "unsupported_entity",
    );
    const nestedPeriod = context().replace(
      "</xbrli:entity>",
      "<xbrli:period><xbrli:instant>2025-01-01</xbrli:instant></xbrli:period></xbrli:entity>",
    );
    expect((await parse(document(fact(), nestedPeriod))).reason).toBe(
      "malformed_context",
    );
  });

  it("preserves an instant as a known different period rather than inventing a duration", async () => {
    const instant = context().replace(
      "<xbrli:startDate>2025-01-01</xbrli:startDate><xbrli:endDate>2025-03-31</xbrli:endDate>",
      "<xbrli:instant>2025-03-31</xbrli:instant>",
    );
    const result = await parse(document(fact(), instant));
    expect(result.status).toBe("no_corresponding_fact");
    expect(result.candidates[0]).toMatchObject({
      periodKind: "instant",
      startDate: null,
      endDate: "2025-03-31",
      issues: ["period_mismatch"],
    });
  });

  it("retains a clean reference while an unresolved matching fact prevents success", async () => {
    const result = await parse(
      document(fact() + fact("100", 'continuedAt="continuation"')),
    );
    expect(result.status).toBe("unsupported");
    expect(result.reason).toBe("unsupported_inline");
    expect(result.candidates).toHaveLength(2);
    expect(result.correspondingCandidateLocators).toHaveLength(1);
  });

  it("returns no partial candidate output when structured output reaches its cap", async () => {
    const html = document(
      fact("€".repeat(4096), 'format="ixt:fixed-zero"').repeat(100),
    );
    expect(await parse(html)).toEqual(emptyResult("output_limit"));
  });

  it("uses the same UTF16 text bound as its consumers and rejects invalid UTF8", async () => {
    const result = await parse(
      document(fact("😀".repeat(2048), 'format="ixt:fixed-zero"')),
      { value: "0" },
    );
    expect(result.status).toBe("matched");
    expect(result.candidates[0]?.rawText).toHaveLength(4096);
    expect(
      (
        await parse(
          document(fact("😀".repeat(2049), 'format="ixt:fixed-zero"')),
        )
      ).reason,
    ).toBe("invalid_document");
    expect(
      await parser().parse({
        document: new Uint8Array([255]),
        cik: "0000000042",
        selection,
      }),
    ).toEqual(emptyResult("invalid_document"));
  });

  it("supports each selected concept and dates through an amended quarterly form", async () => {
    for (const concept of [
      "Revenues",
      "SalesRevenueNet",
      "RevenueFromContractWithCustomerExcludingAssessedTax",
      "NetIncomeLoss",
    ] as const) {
      const result = await parse(
        document(fact().replace("Revenues", concept)),
        {
          concept,
          metric: concept === "NetIncomeLoss" ? "net_income" : "revenue",
          form: "10-Q/A",
        },
      );
      expect(result.status).toBe("matched");
    }
  });

  it("accepts the candidate cap and rejects the next row without any prefix", async () => {
    expect(
      (await parse(document(fact().repeat(LIMITS.candidates)))).candidates,
    ).toHaveLength(LIMITS.candidates);
    expect(await parse(document(fact().repeat(LIMITS.candidates + 1)))).toEqual(
      emptyResult("candidate_limit"),
    );
  });

  it("rejects excessive tree depth and attributes independently", async () => {
    expect(
      (
        await parse(
          document("<div>".repeat(260) + fact() + "</div>".repeat(260)),
        )
      ).reason,
    ).toBe("depth_limit");
    expect(
      (
        await parse(
          document(
            fact(
              "100",
              Array.from(
                { length: 65 },
                (_, index) => `data-k${index}="a"`,
              ).join(" "),
            ),
          ),
        )
      ).reason,
    ).toBe("attribute_limit");
  });

  it.each([new Uint8Array(), new Uint8Array(LIMITS.documentBytes + 1)])(
    "rejects empty/oversized input before process launch",
    async (bytes) => {
      await expect(
        parser().parse({ document: bytes, cik: "0000000042", selection }),
      ).rejects.toMatchObject({ code: "invalid_request" });
    },
  );

  it("requires selected duration, supported form and canonical exact source value", async () => {
    for (const changes of [
      { startDate: null },
      { form: "10-K" },
      { value: "1e2" },
      { value: "-0" },
      { metric: "net_income" as const },
    ]) {
      await expect(parse(document(), changes)).rejects.toMatchObject({
        code: "invalid_request",
      });
    }
  });
});

function metadataFact(
  concept = "DocumentType",
  value = "10-Q",
  attributes = "",
  contextId = "m",
) {
  return `<ix:nonNumeric name="dei:${concept}" contextRef="${contextId}" ${attributes}>${value}</ix:nonNumeric>`;
}
function metadataDocument(
  rows = metadataFact(),
  contexts = context("m", "2024-07-01", "2025-03-31"),
  namespace: string = PERSONAL_SEC_FILING_DEI_NAMESPACES[1],
) {
  return document(fact() + rows, context() + contexts).replace(
    "<html ",
    `<html xmlns:dei="${namespace}" `,
  );
}

describe("filing DEI reporting metadata real isolated worker", () => {
  it.each(PERSONAL_SEC_FILING_DEI_NAMESPACES)(
    "retains four direct values and separate duration context under %s",
    async (namespace) => {
      const values = ["10-Q/A", "2025-03-31", "2026", "Q1"];
      const rows = PERSONAL_SEC_FILING_REPORTING_CONCEPTS.map(
        (concept, index) =>
          metadataFact(concept, ` \t${values[index]}\r\n `, `id="m${index}"`),
      ).join("");
      const result = await parse(
        metadataDocument(
          `<ix:header><ix:hidden>${rows}</ix:hidden></ix:header>`,
          undefined,
          namespace,
        ),
      );
      expect(result.schemaVersion).toBe("2.0.0");
      expect(result.status).toBe("matched");
      expect(result.candidates[0]?.startDate).toBe("2025-01-01");
      expect(
        result.reportingMetadata.fields.map((field) => [
          field.status,
          field.value,
        ]),
      ).toEqual(values.map((value) => ["observed", value]));
      expect(result.reportingMetadata.observations).toHaveLength(4);
      expect(result.reportingMetadata.observations[0]).toMatchObject({
        contextId: "m",
        startDate: "2024-07-01",
        endDate: "2025-03-31",
        rawText: " \t10-Q/A\r\n ",
        issues: [],
      });
      expect(Object.isFrozen(result.reportingMetadata)).toBe(true);
      expect(
        Object.isFrozen(
          result.reportingMetadata.fields[0]?.observationLocators,
        ),
      ).toBe(true);
      expect(
        Object.isFrozen(result.reportingMetadata.observations[0]?.concept),
      ).toBe(true);
      expect(
        Object.isFrozen(result.reportingMetadata.observations[0]?.issues),
      ).toBe(true);
    },
  );

  it("leaves absent metadata missing and preserves equivalent references without choosing a revision", async () => {
    expect((await parse()).reportingMetadata).toEqual(
      createEmptyPersonalSecFilingReportingMetadata(),
    );
    const equal = await parse(
      metadataDocument(metadataFact() + metadataFact("DocumentType", " 10-Q ")),
    );
    expect(equal.reportingMetadata.fields[0]).toMatchObject({
      status: "observed",
      value: "10-Q",
    });
    expect(equal.reportingMetadata.fields[0]?.observationLocators).toHaveLength(
      2,
    );
    const conflict = await parse(
      metadataDocument(metadataFact() + metadataFact("DocumentType", "10-K")),
    );
    expect(conflict.reportingMetadata.fields[0]).toMatchObject({
      status: "conflicting",
      value: null,
    });
    expect(conflict.status).toBe("matched");
  });

  it.each([
    ["DocumentType", "8-K", ""],
    ["DocumentPeriodEndDate", "2025-02-29", ""],
    ["DocumentPeriodEndDate", "03/31/2025", ""],
    ["DocumentFiscalYearFocus", "0999", ""],
    ["DocumentFiscalPeriodFocus", "Q4", ""],
    ["DocumentFiscalPeriodFocus", "q1", ""],
    ["DocumentType", "\u00a010-Q\u00a0", ""],
    ["DocumentPeriodEndDate", "2025-03-31", 'format="ixt:date-year-month-day"'],
    ["DocumentType", "10-Q", 'continuedAt="next"'],
    ["DocumentType", "<span>10-Q</span>", ""],
  ])(
    "keeps unsupported %s metadata explicit",
    async (concept, value, attrs) => {
      const result = await parse(
        metadataDocument(metadataFact(concept, value, attrs)),
      );
      expect(result.status).toBe("matched");
      const field = result.reportingMetadata.fields.find(
        (row) => row.concept === concept,
      );
      expect(field).toMatchObject({ status: "unsupported", value: null });
      expect(field?.observationLocators).toHaveLength(1);
      expect(
        result.reportingMetadata.observations[0]?.issues.length,
      ).toBeGreaterThan(0);
    },
  );

  it.each([
    '<ix:tuple name="us-gaap:Tuple">ROW</ix:tuple>',
    '<ix:continuation id="continued">ROW</ix:continuation>',
    "<ix:exclude>ROW</ix:exclude>",
    '<ix:nonNumeric name="dei:OtherConcept" contextRef="m">ROW</ix:nonNumeric>',
    '<ix:footnote id="metadata-note" footnoteRole="urn:synthetic:note">ROW</ix:footnote>',
  ])(
    "does not admit metadata nested in unsupported inline ancestry %s",
    async (wrapper) => {
      const result = await parse(
        metadataDocument(
          metadataFact() + wrapper.replace("ROW", metadataFact()),
        ),
      );
      expect(result.status).toBe("matched");
      expect(result.reportingMetadata.fields[0]).toMatchObject({
        status: "unsupported",
        value: null,
      });
      expect(
        result.reportingMetadata.fields[0]?.observationLocators,
      ).toHaveLength(2);
      expect(result.reportingMetadata.observations[1]?.issues).toContain(
        "unsupported_inline",
      );
    },
  );

  it.each([
    metadataFact("documenttype", "10-K"),
    '<dei:DocumentType contextRef="m">10-K</dei:DocumentType>',
    metadataFact().replace(
      'name="dei:DocumentType"',
      'name="spoof:DocumentType" xmlns:spoof="https://attacker.invalid/dei/2025"',
    ),
  ])(
    "retains recognizable unsupported forms instead of hiding them behind a clean sibling",
    async (row) => {
      const result = await parse(metadataDocument(metadataFact() + row));
      expect(result.status).toBe("matched");
      expect(result.reportingMetadata.fields[0]).toMatchObject({
        status: "unsupported",
        value: null,
      });
      expect(result.reportingMetadata.observations).toHaveLength(2);
      expect(result.reportingMetadata.observations[1]?.concept.raw).toBe(
        row.includes("documenttype")
          ? "dei:documenttype"
          : row.includes("spoof:")
            ? "spoof:DocumentType"
            : "dei:DocumentType",
      );
    },
  );

  it.each([
    "http://xbrl.sec.gov/dei/2023",
    "https://xbrl.sec.gov/dei/2025",
    "http://xbrl.sec.gov/dei/2025/extra",
  ])("does not infer namespace support for %s", async (namespace) => {
    const result = await parse(
      metadataDocument(undefined, undefined, namespace),
    );
    expect(result.reportingMetadata.observations[0]?.issues).toContain(
      "invalid_namespace",
    );
    expect(result.reportingMetadata.fields[0]?.status).toBe("unsupported");
  });

  it("excludes only proven well-formed wrong-issuer metadata", async () => {
    const wrong = context("other", "2024-07-01", "2025-03-31", "7");
    const clean = metadataFact();
    const wrongFact = metadataFact("DocumentType", "10-K", "", "other");
    const excluded = await parse(metadataDocument(wrongFact, wrong));
    expect(excluded.reportingMetadata.fields[0]?.status).toBe("missing");
    expect(excluded.reportingMetadata.observations[0]?.issues).toEqual([
      "entity_mismatch",
    ]);
    const combined = await parse(
      metadataDocument(clean + wrongFact, context("m") + wrong),
    );
    expect(combined.reportingMetadata.fields[0]).toMatchObject({
      status: "observed",
      value: "10-Q",
    });
    const malformed = wrong.replace(
      "</xbrli:entity>",
      "<xbrli:period><xbrli:instant>2025-01-01</xbrli:instant></xbrli:period></xbrli:entity>",
    );
    const uncertain = await parse(
      metadataDocument(clean + wrongFact, context("m") + malformed),
    );
    expect(uncertain.reportingMetadata.fields[0]?.status).toBe("unsupported");
    expect(uncertain.reportingMetadata.observations[1]?.issues).toEqual(
      expect.arrayContaining(["entity_mismatch", "malformed_context"]),
    );
  });

  it.each([
    "",
    context("m").replace(
      'scheme="http://www.sec.gov/CIK"',
      'scheme="https://www.sec.gov/CIK"',
    ),
    context("m").replace(
      "<xbrli:startDate>2025-01-01</xbrli:startDate><xbrli:endDate>2025-03-31</xbrli:endDate>",
      "<xbrli:instant>2025-03-31</xbrli:instant>",
    ),
    context(
      "m",
      undefined,
      undefined,
      undefined,
      '<xbrli:segment><xbrldi:explicitMember dimension="us-gaap:Axis">us-gaap:Member</xbrldi:explicitMember></xbrli:segment>',
    ),
  ])(
    "does not observe unresolved, unsupported or dimensional context",
    async (contexts) => {
      const result = await parse(metadataDocument(undefined, contexts));
      expect(result.reportingMetadata.fields[0]?.status).toBe("unsupported");
      expect(result.status).toBe("matched");
    },
  );

  it("keeps exactly forty metadata references and fails empty above that cap independently of numeric facts", async () => {
    const complete = await parse(metadataDocument(metadataFact().repeat(40)));
    expect(complete.reportingMetadata.observations).toHaveLength(40);
    expect(complete.reportingMetadata.fields[0]?.status).toBe("observed");
    const limited = await parse(metadataDocument(metadataFact().repeat(41)));
    expect(limited.status).toBe("matched");
    expect(limited.candidates).toHaveLength(1);
    expect(limited.reportingMetadata).toMatchObject({
      status: "limited",
      reason: "candidate_limit",
      observations: [],
    });
    expect(
      limited.reportingMetadata.fields.every(
        (field) =>
          field.status === "unsupported" &&
          field.value === null &&
          field.observationLocators.length === 0,
      ),
    ).toBe(true);
  });

  it("accepts the exact metadata byte budget and clears the whole projection one byte above it", async () => {
    const baseline = await parse(metadataDocument(metadataFact().repeat(40)));
    const remaining =
      LIMITS.metadataOutputBytes -
      Buffer.byteLength(JSON.stringify(baseline.reportingMetadata), "utf8");
    const paddingPerRow = Math.floor(remaining / 40);
    const paddingRemainder = remaining % 40;
    const rows = Array.from({ length: 40 }, (_, index) =>
      metadataFact(
        "DocumentType",
        " ".repeat(paddingPerRow + (index < paddingRemainder ? 1 : 0)) + "10-Q",
      ),
    ).join("");
    expect(paddingPerRow + 5).toBeLessThanOrEqual(LIMITS.rawTextCharacters);
    const exact = await parse(metadataDocument(rows));
    expect(exact.reportingMetadata.status).toBe("assessed");
    expect(
      Buffer.byteLength(JSON.stringify(exact.reportingMetadata), "utf8"),
    ).toBe(LIMITS.metadataOutputBytes);
    const excessive = await parse(
      metadataDocument(rows.replace("10-Q", " 10-Q")),
    );
    expect(excessive.status).toBe("matched");
    expect(excessive.reportingMetadata).toMatchObject({
      status: "limited",
      reason: "output_limit",
      observations: [],
    });
  });

  it.each([
    metadataFact("DocumentType", "x".repeat(4097)),
    metadataFact("DocumentType", "€".repeat(4096)).repeat(6),
  ])(
    "limits metadata text/projection without erasing a numeric match",
    async (rows) => {
      const result = await parse(metadataDocument(rows));
      expect(result.status).toBe("matched");
      expect(result.reportingMetadata).toMatchObject({
        status: "limited",
        reason: "output_limit",
        observations: [],
      });
    },
  );

  it("does not retain metadata after global malformed-document failure", async () => {
    const result = await parse(
      metadataDocument().replace("xmlns:dei=", "XMLNS:dei="),
    );
    expect(result).toEqual(emptyResult("invalid_namespace"));
  });
});

function alternateWorker(script: string) {
  let child: ChildProcessWithoutNullStreams | undefined;
  const launched = vi.fn((...args: unknown[]) => {
    void args;
    child = spawn(process.execPath, ["-e", script], {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return child;
  });
  const value = createPersonalSecFilingContextParser({
    spawn: launched as unknown as typeof spawn,
  });
  parsers.push(value);
  return { value, launched, child: () => child };
}

describe("asynchronous filing worker boundary", () => {
  const input = {
    document: new TextEncoder().encode(document()),
    cik: "0000000042",
    selection,
  };

  it.each([
    ["missing result version", "delete result.schemaVersion"],
    ["old result version", 'result.schemaVersion = "1.0.0"'],
    ["missing metadata", "delete result.reportingMetadata"],
    ["extra metadata key", "result.reportingMetadata.extra = true"],
    ["missing fixed field", "result.reportingMetadata.fields.pop()"],
    ["wrong field order", "result.reportingMetadata.fields.reverse()"],
    [
      "missing reference",
      "result.reportingMetadata.fields[0].observationLocators = []",
    ],
    ["fabricated value", 'result.reportingMetadata.fields[0].value = "10-K"'],
    [
      "invented conflict",
      'result.reportingMetadata.fields[0].status = "conflicting"; result.reportingMetadata.fields[0].value = null',
    ],
    ["hidden observation", "result.reportingMetadata.observations = []"],
    [
      "reused numeric locator",
      "result.reportingMetadata.observations[0].locator = result.candidates[0].locator; result.reportingMetadata.fields[0].observationLocators = [result.candidates[0].locator]",
    ],
    [
      "clean wrong-case QName",
      'result.reportingMetadata.observations[0].concept.raw = "dei:documenttype"; result.reportingMetadata.observations[0].concept.localName = "documenttype"',
    ],
    [
      "clean mismatched QName",
      'result.reportingMetadata.observations[0].concept.raw = "dei:DocumentFiscalYearFocus"',
    ],
    [
      "clean unsupported namespace",
      'result.reportingMetadata.observations[0].concept.namespace = "https://xbrl.sec.gov/dei/2025"',
    ],
    [
      "clean transformed value",
      'result.reportingMetadata.observations[0].format = { raw:"ixt:fixed-zero",localName:"fixed-zero",namespace:"http://www.xbrl.org/inlineXBRL/transformation/2020-02-12" }',
    ],
    [
      "clean instant context",
      'result.reportingMetadata.observations[0].periodKind = "instant"; result.reportingMetadata.observations[0].startDate = null',
    ],
    [
      "forged same-issuer exclusion",
      'result.reportingMetadata.observations[0].issues = ["entity_mismatch"]; result.reportingMetadata.fields[0].status = "missing"; result.reportingMetadata.fields[0].value = null',
    ],
    [
      "forged raw issuer exclusion",
      'result.reportingMetadata.observations[0].issues = ["entity_mismatch"]; result.reportingMetadata.observations[0].entityCik = "0000000007"; result.reportingMetadata.fields[0].status = "missing"; result.reportingMetadata.fields[0].value = null',
    ],
    [
      "forged unresolved issuer exclusion",
      'result.reportingMetadata.observations[0].issues = ["entity_mismatch"]; result.reportingMetadata.observations[0].entityCik = null; result.reportingMetadata.fields[0].status = "missing"; result.reportingMetadata.fields[0].value = null',
    ],
    [
      "uncertainty hidden by observed value",
      'result.reportingMetadata.observations[0].issues = ["unresolved_context"]',
    ],
    [
      "partial limit prefix",
      'result.reportingMetadata.status = "limited"; result.reportingMetadata.reason = "candidate_limit"',
    ],
    [
      "invented global failure",
      'result.reportingMetadata.status = "unavailable"; result.reportingMetadata.reason = "invalid_document"',
    ],
  ])("rejects %s in worker reporting metadata", async (_label, mutation) => {
    const valid = await parse(metadataDocument());
    const script = `process.stdin.resume();process.stdin.on("end",()=>{const result=${JSON.stringify(valid)};${mutation};process.stdout.write(JSON.stringify(result))})`;
    const worker = alternateWorker(script);
    await expect(worker.value.parse(input)).rejects.toMatchObject({
      code: "invalid_output",
    });
  });

  it("sends an explicit versioned worker request", async () => {
    const worker = alternateWorker(
      `let raw="";process.stdin.setEncoding("utf8");process.stdin.on("data",data=>raw+=data);process.stdin.on("end",()=>{const request=JSON.parse(raw);if(request.schemaVersion!=="2.0.0"||Object.keys(request).sort().join(",")!=="cik,documentBase64,schemaVersion,selection")process.exitCode=1;else process.stdout.write(${JSON.stringify(JSON.stringify(emptyResult()))})})`,
    );
    expect(await worker.value.parse(input)).toEqual(emptyResult());
  });

  it("fixes executable/isolated arguments, hides Windows child and excludes inherited secrets", async () => {
    vi.stubEnv("SEC_SECRET_CANARY", "must-not-reach-worker");
    vi.stubEnv("PYTHONPATH", "untrusted-modules");
    const worker = alternateWorker(
      `process.stdin.resume(); process.stdin.on("end",()=>process.stdout.write(${JSON.stringify(JSON.stringify(emptyResult()))}))`,
    );
    expect((await worker.value.parse(input)).status).toBe(
      "no_corresponding_fact",
    );
    const call = worker.launched.mock.calls[0];
    expect(call?.[0]).toBe(process.platform === "win32" ? "python" : "python3");
    expect(call?.[1]).toEqual([
      "-I",
      "-S",
      "-B",
      expect.stringMatching(/personal_sec_filing_context\.py$/u),
    ]);
    expect(call?.[2]).toMatchObject({
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const environment = (call?.[2] as { env: NodeJS.ProcessEnv }).env;
    expect(Object.keys(environment).sort()).toEqual(
      expect.arrayContaining(["LANG", "PATH"]),
    );
    expect(environment.SEC_SECRET_CANARY).toBeUndefined();
    expect(environment.PYTHONPATH).toBeUndefined();
    expect(
      Object.keys(environment).every((key) =>
        ["LANG", "PATH", "SystemRoot", "WINDIR"].includes(key),
      ),
    ).toBe(true);
  });

  it.each([
    ['process.stdout.write("not-json")', "invalid_output"],
    ["process.stdout.write(Buffer.from([255,255]))", "invalid_output"],
    [
      `process.stdout.write(${JSON.stringify(JSON.stringify({ ...emptyResult(), status: "matched" }))})`,
      "invalid_output",
    ],
    [
      `process.stdout.write(${JSON.stringify(JSON.stringify({ ...emptyResult(), extra: true }))})`,
      "invalid_output",
    ],
    [
      'process.stderr.write("private-canary");process.exitCode=2',
      "worker_failed",
    ],
    [
      `process.stdout.write("x".repeat(${LIMITS.workerOutputBytes + 1}))`,
      "output_too_large",
    ],
    [
      `process.stderr.write("x".repeat(${LIMITS.workerStderrBytes + 1}))`,
      "output_too_large",
    ],
  ])("rejects malformed or excessive worker output", async (script, code) => {
    const worker = alternateWorker(
      `process.stdin.resume();process.stdin.on("end",()=>{${script}})`,
    );
    await expect(worker.value.parse(input)).rejects.toMatchObject({
      code,
      message: "Personal SEC filing context parsing is unavailable.",
    });
  });

  it("reports missing runtime without falling back to another executable", async () => {
    const launch = vi.fn(() => {
      throw Error("private executable path");
    });
    const value = createPersonalSecFilingContextParser({
      spawn: launch as unknown as typeof spawn,
    });
    await expect(value.parse(input)).rejects.toMatchObject({
      code: "runtime_unavailable",
    });
    expect(launch).toHaveBeenCalledTimes(1);
  });

  it("cancels an active process, retains the busy guard until exit and ignores late output", async () => {
    const worker = alternateWorker(
      "process.stdin.resume();setInterval(()=>{},1000)",
    );
    const controller = new AbortController();
    const pending = worker.value.parse(input, controller.signal);
    const rejected = expect(pending).rejects.toMatchObject({ code: "aborted" });
    await expect(worker.value.parse(input)).rejects.toMatchObject({
      code: "busy",
    });
    const child = worker.child();
    expect(child).toBeDefined();
    const closed = once(child!, "close");
    controller.abort();
    await rejected;
    await closed;
    expect(child?.killed).toBe(true);
  });

  it("enforces its deadline and terminates the worker", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const worker = alternateWorker(
      "process.stdin.resume();setInterval(()=>{},1000)",
    );
    const pending = worker.value.parse(input);
    const rejected = expect(pending).rejects.toMatchObject({ code: "timeout" });
    const closed = once(worker.child()!, "close");
    await vi.advanceTimersByTimeAsync(LIMITS.workerTimeoutMs);
    await rejected;
    await closed;
    expect(worker.child()?.killed).toBe(true);
  });

  it("aborts on shutdown and never launches after shutdown or pre-cancellation", async () => {
    const worker = alternateWorker(
      "process.stdin.resume();setInterval(()=>{},1000)",
    );
    const aborted = new AbortController();
    aborted.abort();
    await expect(
      worker.value.parse(input, aborted.signal),
    ).rejects.toMatchObject({ code: "aborted" });
    expect(worker.launched).not.toHaveBeenCalled();
    const pending = worker.value.parse(input);
    const rejected = expect(pending).rejects.toMatchObject({ code: "aborted" });
    const closed = once(worker.child()!, "close");
    worker.value.close();
    await rejected;
    await closed;
    await expect(worker.value.parse(input)).rejects.toMatchObject({
      code: "aborted",
    });
    expect(worker.launched).toHaveBeenCalledTimes(1);
  });
});
