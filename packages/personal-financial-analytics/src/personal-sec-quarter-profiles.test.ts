import { describe, expect, it } from "vitest";
import type {
  QuarterContextRecord,
  QuarterUnitRecord,
  QuarterXmlObservation,
} from "@research-cockpit/contracts";
import {
  canonicalQuarterDecimal,
  normalizeQuarterText,
  quarterDate,
  readQuarterContext,
  readQuarterUnit,
  staticStyle,
  supportedGaap,
} from "./personal-sec-quarter-profiles";

type Mutable<T> = T extends object
  ? { -readonly [K in keyof T]: Mutable<T[K]> }
  : T;
type Xml = Mutable<QuarterXmlObservation>;
const XBRLI = "http://www.xbrl.org/2003/instance";
const XBRLDI = "http://xbrl.org/2006/xbrldi";
const attr = (name: string, value: string) => ({
  name,
  value,
  namespace: null,
  localName: name,
});
const q = (localName: string, namespace = XBRLI) => ({
  raw: `prefix:${localName}`,
  namespace,
  localName,
});
function context() {
  let ordinal = 0;
  const node = (
    local: string,
    text = "",
    attributes: Xml["attributes"] = [],
    children: (() => Xml[]) | null = null,
  ): Xml => ({
    elementOrdinal: ++ordinal,
    name: q(local),
    attributes,
    qnameAttributes: [],
    textQName: null,
    textRuns: [{ beforeChildIndex: 0, text }],
    children: children?.() ?? [],
  });
  const root = node("context", "", [attr("id", "duration")], () => [
    node("entity", "", [], () => [
      node("identifier", "999999", [attr("scheme", "http://www.sec.gov/CIK")]),
    ]),
    node("period", "", [], () => [
      node("startDate", "2025-01-01"),
      node("endDate", "2025-03-31"),
    ]),
  ]);
  const record: Mutable<QuarterContextRecord> = {
    id: "c:1",
    xmlId: "duration",
    elementOrdinal: 1,
    root,
  };
  return { record, node };
}
function unit(): Mutable<QuarterUnitRecord> {
  return {
    id: "u:1",
    xmlId: "money",
    elementOrdinal: 1,
    root: {
      elementOrdinal: 1,
      name: q("unit"),
      attributes: [attr("id", "money")],
      qnameAttributes: [],
      textQName: null,
      textRuns: [],
      children: [
        {
          elementOrdinal: 2,
          name: q("measure"),
          attributes: [],
          qnameAttributes: [],
          textQName: {
            raw: "Money:USD",
            namespace: "http://www.xbrl.org/2003/iso4217",
            localName: "USD",
          },
          textRuns: [{ beforeChildIndex: 0, text: "Money:USD" }],
          children: [],
        },
      ],
    },
  };
}

describe("quarter source grammar", () => {
  it("requires a complete positive context grammar before exclusion", () => {
    const f = context();
    expect(readQuarterContext(f.record)).toEqual({
      cik: "0000999999",
      kind: "duration",
      startDate: "2025-01-01",
      endDate: "2025-03-31",
      dimensioned: false,
    });
    f.record.root.children[1]!.children[0]!.textRuns[0]!.text = "2024-01-01";
    f.record.root.children[0]!.children.push(f.node("unexpected", "bad"));
    expect(readQuarterContext(f.record)).toBeNull();
  });
  it.each([
    "https://www.sec.gov/CIK",
    "http://other.example/CIK",
    "http://www.sec.gov/cik",
  ])("rejects an unsupported entity scheme %s", (scheme) => {
    const f = context();
    f.record.root.children[0]!.children[0]!.attributes[0]!.value = scheme;
    expect(readQuarterContext(f.record)).toBeNull();
  });
  it("recognizes a well-formed explicit dimension as structural exclusion", () => {
    const f = context();
    const member = f.node("explicitMember", "Entity:Parent", [
      attr("dimension", "Axes:Scope"),
    ]);
    member.name = q("explicitMember", XBRLDI);
    member.qnameAttributes = [
      {
        name: "dimension",
        value: {
          raw: "Axes:Scope",
          namespace: "https://example.test/axis",
          localName: "Scope",
        },
      },
    ];
    member.textQName = {
      raw: "Entity:Parent",
      namespace: "https://example.test/member",
      localName: "Parent",
    };
    f.record.root.children[0]!.children.push(
      f.node("segment", "", [], () => [member]),
    );
    expect(readQuarterContext(f.record)?.dimensioned).toBe(true);
    member.textQName.namespace = null;
    expect(readQuarterContext(f.record)).toBeNull();
  });
  it("does not classify an empty scenario as a clean whole-entity context", () => {
    const f = context();
    f.record.root.children.push(f.node("scenario"));
    expect(readQuarterContext(f.record)).toBeNull();
  });
  it("refuses duplicate structural period elements", () => {
    const f = context();
    f.record.root.children.push(structuredClone(f.record.root.children[1]!));
    expect(readQuarterContext(f.record)).toBeNull();
  });
  it("recognizes USD by exact resolved QName, not its raw prefix", () => {
    const f = unit();
    expect(readQuarterUnit(f)).toBe("USD");
    f.root.children[0]!.textQName!.namespace = "https://foreign.example/money";
    expect(readQuarterUnit(f)).toBe("other");
    f.root.children[0]!.textQName = null;
    expect(readQuarterUnit(f)).toBeNull();
  });
  it("does not treat a complex unit as USD", () => {
    const f = unit();
    f.root.children[0]!.name = q("divide");
    expect(readQuarterUnit(f)).toBeNull();
  });
  it.each(["2025-02-29", "2025-04-31", "2025-1-01", "2025-00-10"])(
    "rejects normalized or malformed date %s",
    (date) => expect(quarterDate(date)).toBe(false),
  );
  it("accepts leap-day dates without imposing a fixed day-count quarter", () =>
    expect(quarterDate("2024-02-29")).toBe(true));
  it.each([
    "https://fasb.org/us-gaap/2025",
    "http://xbrl.us/us-gaap/2025",
    "http://fasb.org/us-gaap/2008",
    "http://fasb.org/us-gaap/2025-02-29",
  ])("rejects unsupported taxonomy namespace %s", (namespace) =>
    expect(supportedGaap(namespace)).toBe(false),
  );
  it("accepts the exact supported GAAP namespace dates", () => {
    expect(supportedGaap("http://fasb.org/us-gaap/2009")).toBe(true);
    expect(supportedGaap("http://fasb.org/us-gaap/2025-01-31")).toBe(true);
  });
  it("canonicalizes decimal spelling without arithmetic rounding", () => {
    expect(canonicalQuarterDecimal("-000.000")).toBe("0");
    expect(canonicalQuarterDecimal("000123.45000")).toBe("123.45");
    expect(
      canonicalQuarterDecimal("123456789012345678901234567890.123456789"),
    ).toBe("123456789012345678901234567890.123456789");
  });
  it.each(["1e6", "+1", "NaN", "Infinity", "1,000", "1.", "9".repeat(65)])(
    "refuses nonliteral or oversized decimal %s",
    (value) => expect(canonicalQuarterDecimal(value)).toBeNull(),
  );
  it("only collapses source whitespace and ASCII letter case", () =>
    expect(normalizeQuarterText("  Net\u00a0LOSS\n(USD)  ")).toBe(
      "net loss (usd)",
    ));
  it.each([
    "font-family:'Times New Roman';font-size:10pt;color:#000;background-color:white",
    "display:table-cell;vertical-align:middle;padding:0 2pt",
    "font-weight:bold;text-align:right;border-bottom:1pt solid black",
  ])("accepts finite ordinary static style %s", (style) =>
    expect(staticStyle(style)).toBe(true),
  );
  it.each([
    "display:none",
    "display:block;display:none",
    "color:transparent",
    "color:#fff",
    "background-color:black",
    "opacity:.5",
    "clip:rect(0,0,0,0)",
    "transform:scale(0)",
    "visibility:hidden",
    "position:fixed",
    "font-size:0pt",
    "text-indent:-1000pt",
    "content:'100'",
    "filter:opacity(0)",
    "color:var(--text)",
    "font-family:'Times New Roman\"",
    "color:black;/* hidden */display:none",
  ])("holds unsupported visibility style %s", (style) =>
    expect(staticStyle(style)).toBe(false),
  );
});
