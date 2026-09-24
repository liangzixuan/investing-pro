import { describe, expect, it } from "vitest";
import { projectPersonalSecQuarterCompanyFacts as project } from "./personal-sec-quarter-assessment-company-facts";
import {
  PersonalSecQuarterSourceProjectionError,
  parsePersonalSecSourceJsonStrict,
} from "./personal-sec-source-json";
import { personalSecSourceNumberLexeme } from "./personal-sec-quarterly-evidence-provider";

const cik = "0000000001";
const accession = "0000000001-26-000001";
const concept = "Revenues";
const rawRow = (value = "1", extra = "") =>
  `{"start":"2026-01-01","end":"2026-03-31","val":${value},"accn":"${accession}","fy":2026,"fp":"Q1","form":"10-Q","filed":"2026-04-15"${extra}}`;
const bytes = (units: string, other = "") =>
  new TextEncoder().encode(
    `{"cik":1,"facts":{"us-gaap":{"${concept}":{"units":${units}}${other}}}}`,
  );
const failure = (input: Uint8Array, code: string) => {
  try {
    project(input, cik, accession);
    expect.fail("Expected bounded source refusal");
  } catch (error) {
    expect(error).toBeInstanceOf(PersonalSecQuarterSourceProjectionError);
    expect((error as PersonalSecQuarterSourceProjectionError).code).toBe(code);
  }
};

describe("complete selected-accession Company Facts", () => {
  it("preserves exact signed/unsafe/exponent numeric lexemes and equal duplicate occurrences", () => {
    const row = rawRow("-123456789012345678901234567890e-3");
    const result = project(bytes(`{"USD":[${row},${row}]}`), cik, accession);
    expect(result.occurrences).toHaveLength(2);
    expect(result.occurrences.map((r) => r.id)).toEqual([
      "cf:1:0:0",
      "cf:1:0:1",
    ]);
    expect(result.occurrences[0]!.value).toBe(
      "-123456789012345678901234567.89",
    );
    expect(
      result.occurrences[0]!.rawFields.find((f) => f.name === "val")!.text,
    ).toBe("-123456789012345678901234567890e-3");
    expect(result.occurrences[0]!.issues).toEqual([]);
    expect(Object.isFrozen(result.occurrences[0]!.rawFields)).toBe(true);
  });
  it("retains all units and ambiguous membership while counting only proven other accessions out", () => {
    const other = rawRow().replace(accession, "0000000001-25-000001");
    const result = project(
      bytes(
        `{"USD":[${other},${rawRow()}],"EUR":[${rawRow()}],"broken/key~":[null,{"val":0}]}`,
      ),
      cik,
      accession,
    );
    expect(result.inspectedRows).toBe(5);
    expect(result.otherAccessionRows).toBe(1);
    expect(result.occurrences.map((r) => r.unitKey)).toEqual([
      "USD",
      "EUR",
      "broken/key~",
      "broken/key~",
    ]);
    expect(result.occurrences[2]!.sourceLocator).toContain("broken~1key~0");
    expect(result.occurrences[2]!.nonObjectRow).toEqual({
      kind: "null",
      text: "null",
    });
    expect(result.occurrences[3]!.accessionMembership).toBe("potential");
  });
  it("retains malformed apparent dates and wrong numeric types", () => {
    const row = rawRow('"1"').replace("2026-01-01", "2025-02-30");
    const result = project(bytes(`{"USD":[${row}]}`), cik, accession);
    expect(result.occurrences[0]!.startDate).toBeNull();
    expect(result.occurrences[0]!.value).toBeNull();
    expect(result.occurrences[0]!.issues).toEqual([
      "invalid_start_date",
      "invalid_numeric",
    ]);
  });
  it("retains unknown fields and nested unsafe literals without interpreting scope", () => {
    const result = project(
      bytes(
        `{"USD":[${rawRow("0", ',"dimensions":{"member":9007199254740993}')}]}`,
      ),
      cik,
      accession,
    );
    expect(result.occurrences[0]!.rawFields.at(-1)).toEqual({
      name: "dimensions",
      kind: "object",
      text: '{"member":9007199254740993}',
    });
    expect(result.occurrences[0]!.issues).toContain("unsupported_row_fields");
    expect(result.occurrences[0]!.value).toBe("0");
  });
  it("records complete missing concepts independently", () => {
    const result = project(
      new TextEncoder().encode('{"cik":1,"facts":{}}'),
      cik,
      accession,
    );
    expect(result.populations).toHaveLength(4);
    expect(
      result.populations.every((p) => !p.present && p.retainedIds.length === 0),
    ).toBe(true);
  });
  it.each(["null", "[]", '{"USD":null}'])(
    "refuses malformed relevant unit structure %s",
    (units) => failure(bytes(units), "company_facts_structure_invalid"),
  );
  it("refuses duplicate keys before either interpretation can discard an occurrence", () => {
    failure(bytes(`{"USD":[${rawRow()}],"USD":[]}`), "duplicate_json_key");
    failure(
      new TextEncoder().encode('{"cik":1,"facts":{},"\\u0063ik":2}'),
      "duplicate_json_key",
    );
  });
  it("preserves strict Submissions lossless number instances", () => {
    const parsed = parsePersonalSecSourceJsonStrict(
      '{"n":9007199254740993}',
    ) as { n: unknown };
    expect(personalSecSourceNumberLexeme(parsed.n)).toBe("9007199254740993");
  });
  it("refuses per-concept 513 without returning a prefix", () =>
    failure(
      bytes(
        `{"USD":[${Array.from({ length: 513 }, () => rawRow()).join(",")}]}`,
      ),
      "candidate_limit",
    ));
  it("counts other-accession rows toward the 20000 scan ceiling", () => {
    const row = '{"accn":"0000000001-25-000001"}';
    const accepted = project(
      bytes(`{"USD":[${Array.from({ length: 20_000 }, () => row).join(",")}]}`),
      cik,
      accession,
    );
    expect(accepted.inspectedRows).toBe(20_000);
    expect(accepted.occurrences).toHaveLength(0);
    failure(
      bytes(`{"USD":[${Array.from({ length: 20_001 }, () => row).join(",")}]}`),
      "candidate_limit",
    );
  });
  it("refuses lossless field overflow and projection byte overflow", () => {
    failure(
      bytes(`{"USD":[${rawRow("1", `,"extra":"${"x".repeat(4097)}"`)}]}`),
      "company_facts_field_limit",
    );
    failure(
      bytes(
        `{"USD":[${Array.from({ length: 400 }, () => rawRow()).join(",")}]}`,
      ),
      "company_facts_projection_limit",
    );
  });
  it("rejects source identity and invalid UTF-8 without returning row data", () => {
    failure(
      new TextEncoder().encode('{"cik":2,"facts":{}}'),
      "company_facts_structure_invalid",
    );
    failure(Uint8Array.from([255]), "invalid_response");
  });
});
