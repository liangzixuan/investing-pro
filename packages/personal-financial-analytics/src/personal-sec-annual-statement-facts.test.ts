import { describe, expect, it } from "vitest";
import { PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY as registry } from "@research-cockpit/contracts";
import {
  assertPersonalSecAnnualCanonicalEvidence as admit,
  serializePersonalSecAnnualCanonicalGeneration as serialize,
} from "./personal-sec-annual-statement-facts";
import {
  fixture,
  observation,
  setScan,
  type Fixture,
} from "./personal-sec-annual-statements.fixture";

describe("canonical annual statement evidence admission", () => {
  it("admits the complete 3200-row graph without clipping and retains exact signed decimals", () => {
    const input = fixture(
      registry.flatMap((entry) =>
        Array.from({ length: 100 }, (_, index) =>
          observation(entry.concept, index, {
            value: index === 0 ? "-9007199254740993.125" : "0",
          }),
        ),
      ),
    );
    expect(() => admit(input)).not.toThrow();
    expect(input.facts.observations).toHaveLength(3200);
    expect(serialize(input)).toContain("-9007199254740993.125");
  });
  it("admits concept-local failed scans and complete overflow accounting without selected rows", () => {
    const input = fixture();
    setScan(input, "NetIncomeLoss", {
      status: "invalid_response",
      absence: null,
      coverage: null,
    });
    setScan(input, "Revenues", {
      status: "available",
      absence: null,
      coverage: {
        full: {
          candidateRows: 103,
          inspectedRows: 103,
          invalidRows: 1,
          duplicateRows: 1,
          uniqueObservations: 101,
        },
        selected: 101,
        otherAccessions: 0,
        returned: 0,
        omittedSelected: 101,
      },
    });
    expect(() => admit(input)).not.toThrow();
  });
  it("admits an unresolved target with unknown selected counts and no selected graph", () => {
    const input = fixture();
    input.target = {
      status: "unresolved",
      reason: "no_observed_annual_target",
    };
    for (const item of input.facts.scans)
      if (item.scan.status === "available")
        Object.assign(item.scan.coverage, {
          selected: null,
          otherAccessions: null,
          omittedSelected: null,
        });
    expect(() => admit(input)).not.toThrow();
  });
  it.each([
    [
      "top-level extra field",
      (v: Fixture) => Object.assign(v, { legacyIncome: [] }),
    ],
    [
      "wrong version",
      (v: Fixture) =>
        Object.assign(v.generation, { definitionVersion: "5.0.0" }),
    ],
    [
      "wrong registry version",
      (v: Fixture) => Object.assign(v.facts, { registryVersion: "2.0.0" }),
    ],
    ["wrong scan order", (v: Fixture) => v.facts.scans.reverse()],
    ["missing scan", (v: Fixture) => v.facts.scans.pop()],
    [
      "extra metric",
      (v: Fixture) =>
        Object.assign(v.facts.observations[0]!, { metric: "net_income" }),
    ],
    [
      "other CIK source",
      (v: Fixture) =>
        (v.generation.sources.companyFacts.sourceUrl += "?cik=43"),
    ],
    [
      "other archive CIK",
      (v: Fixture) =>
        (v.facts.observations[0]!.filing.sourceUrl =
          "https://www.sec.gov/Archives/edgar/data/43/other-index.htm"),
    ],
    [
      "old accession",
      (v: Fixture) =>
        (v.facts.observations[0]!.accessionNumber = "0000999999-25-000001"),
    ],
    [
      "forged matched join",
      (v: Fixture) =>
        (v.facts.observations[0]!.filing.filedDate = "2026-01-31"),
    ],
    [
      "invalid duration arithmetic",
      (v: Fixture) => (v.facts.observations[0]!.durationDays = 364),
    ],
    [
      "invalid date",
      (v: Fixture) => (v.facts.observations[0]!.endDate = "2025-09-31"),
    ],
    [
      "invalid ID",
      (v: Fixture) =>
        Object.assign(v.facts.observations[0]!, { id: "sec-fact:bogus" }),
    ],
    [
      "candidate pointer out of range",
      (v: Fixture) =>
        (v.facts.observations[0]!.sourceLocator =
          "/facts/us-gaap/Revenues/units/USD/1"),
    ],
    [
      "wrong pointer concept",
      (v: Fixture) =>
        (v.facts.observations[0]!.sourceLocator =
          "/facts/us-gaap/NetIncomeLoss/units/USD/0"),
    ],
    [
      "control in frame",
      (v: Fixture) => (v.facts.observations[0]!.frame = "x\ny"),
    ],
    [
      "oversized frame",
      (v: Fixture) => (v.facts.observations[0]!.frame = "x".repeat(129)),
    ],
    [
      "untrimmed focus",
      (v: Fixture) => (v.facts.observations[0]!.filingFocusPeriod = " FY"),
    ],
    [
      "unnormalized form",
      (v: Fixture) => (v.facts.observations[0]!.form = "$invalid"),
    ],
    [
      "bad capture tuple",
      (v: Fixture) => (v.generation.sources.companyFacts.bytes = null),
    ],
    [
      "oversized source",
      (v: Fixture) => (v.generation.sources.companyFacts.bytes = 8388609),
    ],
  ])("rejects %s", (_label, mutate) => {
    const input = fixture([observation("Revenues")]);
    mutate(input);
    expect(() => admit(input)).toThrow(TypeError);
  });
  it.each([
    "",
    "NaN",
    "Infinity",
    "1e3",
    "01",
    "-0",
    "1.0",
    "0.00",
    "1".repeat(65),
    1,
    null,
  ])("rejects noncanonical decimal %s", (value) => {
    const input = fixture([observation("Revenues")]);
    Object.assign(input.facts.observations[0]!, { value });
    expect(() => admit(input)).toThrow(TypeError);
  });
  it.each([
    ["candidate arithmetic", { candidateRows: 2 }],
    ["inspected arithmetic", { inspectedRows: 2 }],
    ["invalid arithmetic", { invalidRows: 1 }],
    ["duplicate arithmetic", { duplicateRows: 1 }],
    ["unique arithmetic", { uniqueObservations: 2 }],
    ["nonfinite", { candidateRows: Infinity }],
    ["negative", { invalidRows: -1 }],
    ["fractional", { duplicateRows: 0.5 }],
    [
      "scan bound",
      { candidateRows: 10001, inspectedRows: 10001, uniqueObservations: 10001 },
    ],
  ])("rejects forged %s", (_label, changes) => {
    const input = fixture([observation("Revenues")]);
    const scan = input.facts.scans.find((s) => s.concept === "Revenues")!.scan;
    if (scan.status !== "available") throw Error();
    Object.assign(scan.coverage.full, changes);
    expect(() => admit(input)).toThrow(TypeError);
  });
  it.each([
    ["selected count", { selected: 0 }],
    ["other count", { otherAccessions: 1 }],
    ["returned count", { returned: 0 }],
    ["omitted count", { omittedSelected: 1 }],
    ["unknown selected", { selected: null }],
    ["unbounded returned", { returned: 101 }],
  ])("rejects forged %s", (_label, changes) => {
    const input = fixture([observation("Revenues")]);
    const scan = input.facts.scans.find((s) => s.concept === "Revenues")!.scan;
    if (scan.status !== "available") throw Error();
    Object.assign(scan.coverage, changes);
    expect(() => admit(input)).toThrow(TypeError);
  });
  it("rejects duplicate identities, noncanonical ordering, and a per-concept overflow", () => {
    const valid = fixture([
      observation("Revenues", 0),
      observation("Revenues", 1),
    ]);
    for (const mutate of [
      (v: Fixture) =>
        (v.facts.observations[1]!.id = v.facts.observations[0]!.id),
      (v: Fixture) =>
        (v.facts.observations[1]!.sourceLocator =
          v.facts.observations[0]!.sourceLocator),
      (v: Fixture) => v.facts.observations.reverse(),
    ]) {
      const input = structuredClone(valid);
      mutate(input);
      expect(() => admit(input)).toThrow(TypeError);
    }
    expect(() =>
      admit(
        fixture(
          Array.from({ length: 101 }, (_, i) => observation("Revenues", i)),
        ),
      ),
    ).toThrow(TypeError);
    const tooLarge = fixture();
    tooLarge.facts.observations = Array.from({ length: 3201 }, () =>
      observation("Revenues"),
    );
    expect(() => admit(tooLarge)).toThrow(TypeError);
  });
  it("retains shaped unmatched or conflicted metadata for deterministic cell refusal", () => {
    const base = observation("Revenues");
    for (const filing of [
      { ...base.filing, status: "metadata_conflict" as const },
      {
        status: "not_in_current_submissions" as const,
        form: null,
        filedDate: null,
        reportDate: null,
        acceptedAt: null,
        sourceUrl: null,
      },
    ]) {
      expect(() =>
        admit(
          fixture([
            observation("Revenues", 0, {
              form: "10-Q",
              filedDate: "2026-01-31",
              filing,
            }),
          ]),
        ),
      ).not.toThrow();
    }
  });
  it("requires source status, scans and unresolved selection to agree", () => {
    const input = fixture();
    input.generation.sources.companyFacts = {
      ...input.generation.sources.companyFacts,
      status: "rate_limited",
      fetchedAt: null,
      sha256: null,
      bytes: null,
    };
    expect(() => admit(input)).toThrow(TypeError);
    for (const item of input.facts.scans)
      setScan(input, item.concept, {
        status: "source_unavailable",
        absence: null,
        coverage: null,
      });
    expect(() => admit(input)).not.toThrow();
    input.generation.sources.submissions = {
      ...input.generation.sources.submissions,
      status: "upstream_unavailable",
      fetchedAt: null,
      sha256: null,
      bytes: null,
    };
    expect(() => admit(input)).toThrow(TypeError);
    input.target = { status: "unresolved", reason: "submissions_unavailable" };
    input.targetScan = null;
    expect(() => admit(input)).not.toThrow();
  });
  it("rejects accessors at each boundary without invoking them", () => {
    for (const locate of [
      (v: Fixture) => [v, "facts"] as const,
      (v: Fixture) => [v.generation.sources.companyFacts, "status"] as const,
      (v: Fixture) => [v.facts.observations[0]!, "value"] as const,
      (v: Fixture) => [v.facts.observations, "0"] as const,
      (v: Fixture) => [v.facts.scans[0]!, "scan"] as const,
    ]) {
      const input = fixture([observation("Revenues")]);
      let calls = 0;
      const [object, key] = locate(input);
      Object.defineProperty(object, key, {
        enumerable: true,
        get() {
          calls++;
          throw Error("getter invoked");
        },
      });
      expect(() => admit(input)).toThrow(TypeError);
      expect(calls).toBe(0);
    }
  });
  it("rejects symbols, hidden keys, inherited records and custom or sparse arrays", () => {
    for (const mutate of [
      (v: Fixture) => Object.defineProperty(v, Symbol("hidden"), { value: 1 }),
      (v: Fixture) => Object.defineProperty(v, "hidden", { value: 1 }),
      (v: Fixture): void => {
        Object.setPrototypeOf(v.facts, { inherited: 1 });
      },
      (v: Fixture) => Object.assign(v.facts.scans, { extra: 1 }),
      (v: Fixture): void => {
        Object.setPrototypeOf(v.facts.scans, {});
      },
      (v: Fixture) => {
        Reflect.deleteProperty(v.facts.scans, "0");
      },
    ]) {
      const input = fixture();
      mutate(input);
      expect(() => admit(input)).toThrow(TypeError);
    }
  });
});

describe("canonical generation serialization", () => {
  it("uses fixed field order, excludes only its own digest, and does not claim cryptographic verification", () => {
    const input = fixture([observation("Revenues")]);
    const original = serialize(input);
    const reordered = JSON.parse(
      JSON.stringify(input, (_key, value: unknown) =>
        value !== null && typeof value === "object" && !Array.isArray(value)
          ? Object.fromEntries(Object.entries(value).reverse())
          : value,
      ),
    ) as Fixture;
    expect(serialize(reordered)).toBe(original);
    input.generation.sha256 = `sha256:${"a".repeat(64)}`;
    expect(serialize(input)).toBe(original);
    input.facts.observations[0]!.id = `sec-fact:${"f".repeat(64)}`;
    expect(() => admit(input)).not.toThrow();
    expect(serialize(input)).not.toBe(original);
  });
  it.each([
    [
      "original value",
      (v: Fixture) => (v.facts.observations[0]!.value = "-7.25"),
    ],
    [
      "original frame",
      (v: Fixture) => (v.facts.observations[0]!.frame = "another"),
    ],
    [
      "join status",
      (v: Fixture) =>
        (v.facts.observations[0]!.filing.status = "metadata_conflict"),
    ],
    [
      "source digest",
      (v: Fixture) =>
        (v.generation.sources.companyFacts.sha256 = `sha256:${"b".repeat(64)}`),
    ],
    [
      "capture time",
      (v: Fixture) =>
        (v.generation.sources.companyFacts.fetchedAt =
          "2026-02-02T06:00:01.500Z"),
    ],
    [
      "original scan accounting",
      (v: Fixture) => {
        const s = v.facts.scans.find((s) => s.concept === "Revenues")!.scan;
        if (s.status === "available") {
          s.coverage.full.candidateRows++;
          s.coverage.full.inspectedRows++;
          s.coverage.full.duplicateRows++;
        }
      },
    ],
    [
      "target scan",
      (v: Fixture) => {
        v.targetScan!.olderHistoryAvailable = false;
      },
    ],
  ])("binds %s", (_label, mutate) => {
    const input = fixture([observation("Revenues")]);
    const before = serialize(input);
    mutate(input);
    expect(serialize(input)).not.toBe(before);
  });
  it("refuses malformed input before serialization", () => {
    const input = fixture();
    Object.assign(input, { extra: 1 });
    expect(() => serialize(input)).toThrow(TypeError);
  });
});
